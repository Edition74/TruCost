const $ = (id) => document.getElementById(id);
const radio = (name) => document.querySelector(`input[name=${name}]:checked`).value;

// ---------- Fields: number box plus slider, kept in sync ----------
const fields = {};
const sig = (v, n) => Number(v.toPrecision(n));

function buildField(el) {
  const d = el.dataset;
  const f = { cfg: { min: +d.min, max: +d.max, step: +d.step || 1, log: 'log' in d } };
  el.innerHTML =
    `<div class="field-top"><label for="${d.id}">${d.label}</label>` +
    `<span class="num">${d.prefix ? `<i>${d.prefix}</i>` : ''}` +
    `<input id="${d.id}" type="number" inputmode="decimal" step="any">` +
    `${d.suffix ? `<i>${d.suffix}</i>` : ''}</span></div>` +
    `<input class="range" id="${d.id}-range" type="range" min="0" max="1000" step="1" aria-label="${d.label}">`;
  f.label = el.querySelector('label');
  f.num = el.querySelector('input[type=number]');
  f.range = el.querySelector('input[type=range]');

  f.toPos = (v) => {
    const { min, max, log } = f.cfg;
    const c = Math.min(max, Math.max(min, v));
    return 1000 * (log ? Math.log(c / min) / Math.log(max / min) : (c - min) / (max - min));
  };
  f.fromPos = (p) => {
    const { min, max, step, log } = f.cfg;
    if (log) {
      const v = min * Math.pow(max / min, p / 1000);
      return v >= 100 ? Math.round(sig(v, 3)) : Number(sig(v, 3).toFixed(2));
    }
    const v = min + ((max - min) * p) / 1000;
    return Number((Math.round(v / step) * step).toFixed(2));
  };
  f.paint = () => f.range.style.setProperty('--p', f.range.value / 10 + '%');
  f.set = (v) => { f.num.value = v; f.range.value = f.toPos(v); f.paint(); };
  f.get = () => { const v = parseFloat(f.num.value); return Number.isFinite(v) ? v : null; };

  f.range.addEventListener('input', () => { f.num.value = f.fromPos(+f.range.value); f.paint(); });
  f.num.addEventListener('input', () => {
    const v = parseFloat(f.num.value);
    if (Number.isFinite(v)) f.range.value = f.toPos(v);
    f.paint();
  });
  f.set(+d.value);
  fields[d.id] = f;
}
document.querySelectorAll('.field').forEach(buildField);

// ---------- Pay period: convert the current figure when the period changes ----------
const PERIODS = {
  hourly:  { label: 'Pay per hour',  min: 5,    max: 150,    step: 0.5 },
  daily:   { label: 'Pay per day',   min: 40,   max: 1200,   step: 5 },
  weekly:  { label: 'Pay per week',  min: 200,  max: 6000,   step: 10 },
  monthly: { label: 'Pay per month', min: 800,  max: 25000,  step: 50 },
  annual:  { label: 'Pay per year',  min: 10000, max: 300000, step: 500 },
};
let currentPeriod = 'annual';

document.querySelectorAll('input[name=period]').forEach((r) =>
  r.addEventListener('change', () => {
    const next = r.value, e = fields.earn;
    const hpw = fields.hours.get() || 40, hol = fields.holiday.get() ?? 5;
    const annual = annualise(e.get() || 0, currentPeriod, hpw, hol);
    const p = PERIODS[next];
    Object.assign(e.cfg, { min: p.min, max: p.max, step: p.step });
    e.label.textContent = p.label;
    e.set(Number((Math.round(fromAnnual(annual, next, hpw, hol) / p.step) * p.step).toFixed(2)));
    currentPeriod = next;
  })
);

// ---------- Formatting ----------
function fmtDuration(hours) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} minutes`;
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  const days = hours / 8;
  if (days < 60) return `${days.toFixed(1)} working days`;
  const years = hours / (8 * 5 * 52);
  if (years < 1) return `${(days / 21.7).toFixed(1)} working months`;
  return `${years.toFixed(1)} working years`;
}
const gbp = (n) => '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
const pct = (x) => (x * 100 < 0.1 ? '<0.1%' : (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%');

// ---------- Run ----------
function run() {
  const price = fields.price.get(), age = fields.age.get();
  const earn = fields.earn.get(), hours = fields.hours.get();
  const box = $('result');
  box.hidden = false;

  const missing = [];
  if (!(price > 0)) missing.push('price');
  if (!age) missing.push('age');
  if (!(earn > 0)) missing.push('pay');
  if (!(hours > 0)) missing.push('weekly hours');
  if (missing.length) {
    $('bigNumber').textContent = 'Missing details';
    $('bigSub').textContent = `Add your ${missing.join(', ')} and press the button again.`;
    $('tiles').innerHTML = $('lifebar').innerHTML = $('details').innerHTML = '';
    return;
  }

  const holiday = fields.holiday.get() ?? 5;
  const gross = annualise(earn, currentPeriod, hours, holiday);
  const pay = estimateTakeHome(gross, fields.otherPct.get() ?? 0);
  const frequency = radio('frequency');
  const lifeExp = parseFloat($('lifeExp').value);
  const r = calculate({
    price, frequency,
    takeHomeAnnual: pay.takeHome,
    hoursPerWeek: hours,
    commuteHoursPerWeek: fields.commute.get() ?? 0,
    holidayWeeks: holiday,
    age,
    sex: $('sex').value,
    retirementAge: fields.retire.get() ?? 67,
    lifeExpectancyOverride: Number.isFinite(lifeExp) ? lifeExp : null,
  });

  $('bigNumber').textContent = fmtDuration(r.hoursOfLife) + ' of your life';
  $('bigSub').textContent = frequency !== 'once'
    ? `${gbp(price)} ${frequency === 'monthly' ? 'a month' : 'a year'} for ${r.horizonYears.toFixed(0)} years is ${gbp(r.totalCost)} in total`
    : `The time it takes to earn ${gbp(r.totalCost)} after tax`;

  $('tiles').innerHTML = [
    [(r.workingDays < 10 ? r.workingDays.toFixed(1) : Math.round(r.workingDays).toLocaleString('en-GB')), 'working days'],
    [r.shareOfWorkingLife == null ? 'n/a' : pct(r.shareOfWorkingLife), 'of your working life left'],
    [r.shareOfAwakeLife == null ? 'n/a' : pct(r.shareOfAwakeLife), 'of your waking life left'],
  ].map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('');

  // Life bar: remaining years split into working and retired; accent slice is this purchase.
  const total = r.yearsLeft || 1;
  const workPct = (r.workingYearsLeft / total) * 100;
  const slice = r.shareOfWorkingLife == null ? 0 : Math.min(100, Math.max(1.5, r.shareOfWorkingLife * 100));
  const retireAt = Math.round(age + r.workingYearsLeft);
  $('lifebar').innerHTML = workPct > 0
    ? `<div class="lifebar"><div class="lb-work" style="width:${workPct}%"><div class="lb-cost" style="width:${slice}%"></div></div></div>` +
      `<div class="lb-ticks"><span>Now, ${age}</span><span>Retire, ${retireAt}</span><span>About ${Math.round(r.deathAge)}</span></div>` +
      `<p class="lb-note">The bright slice is this purchase, out of the working years you have left.</p>`
    : `<p class="lb-note">You are past retirement age, so only your waking life is compared.</p>`;

  $('details').innerHTML = [
    ['Estimated take-home pay', `${gbp(pay.takeHome)} a year`],
    ['Tax and National Insurance', `${gbp(pay.incomeTax + pay.ni)} a year`],
    ['Your hourly rate on paper', `£${r.paidHourlyRate.toFixed(2)}`],
    ['Your real hourly rate, with commute', `£${r.trueHourlyRate.toFixed(2)}`],
    ['Estimated years left', `${r.yearsLeft.toFixed(1)}, to age ${r.deathAge.toFixed(0)}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

$('run').addEventListener('click', run);
$('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
