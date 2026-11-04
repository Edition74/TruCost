const $ = (id) => document.getElementById(id);
const num = (id) => {
  const v = parseFloat($(id).value);
  return Number.isFinite(v) ? v : null;
};

function fmtDuration(hours) {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  if (hours < 48) return `${hours.toFixed(1)} hours`;
  const days = hours / 8;
  if (days < 60) return `${days.toFixed(1)} working days`;
  const years = hours / (8 * 5 * 52);
  if (years < 1) return `${(days / 21.7).toFixed(1)} working months`;
  return `${years.toFixed(1)} working years`;
}

const gbp = (n) => '£' + n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
const pct = (x) => (x * 100 < 0.1 ? '<0.1%' : (x * 100).toFixed(x < 0.1 ? 2 : 1) + '%');

function run() {
  const price = num('price');
  const age = num('age');
  const gross = num('gross');
  const hours = num('hours');
  const box = $('result'), big = $('bigNumber'), sub = $('bigSub'), dl = $('details');
  box.hidden = false;

  const missing = [];
  if (!(price > 0)) missing.push('price');
  if (!age) missing.push('age');
  if (!(gross > 0)) missing.push('salary');
  if (!(hours > 0)) missing.push('weekly hours');
  if (missing.length) {
    big.textContent = 'Missing details';
    sub.textContent = `Add your ${missing.join(', ')} and press the button again.`;
    dl.innerHTML = '';
    return;
  }

  const pay = estimateTakeHome(gross, num('otherPct') ?? 0);
  const r = calculate({
    price,
    frequency: $('frequency').value,
    takeHomeAnnual: pay.takeHome,
    hoursPerWeek: hours,
    commuteHoursPerWeek: num('commute') ?? 0,
    holidayWeeks: num('holiday') ?? 5,
    age,
    sex: $('sex').value,
    retirementAge: num('retire') ?? 67,
    lifeExpectancyOverride: num('lifeExp'),
  });

  big.textContent = fmtDuration(r.hoursOfLife) + ' of your life';
  const recurring = $('frequency').value !== 'once';
  sub.textContent = recurring
    ? `Total over ${r.horizonYears.toFixed(0)} remaining years: ${gbp(r.totalCost)}`
    : `To earn ${gbp(r.totalCost)} after tax`;

  const rows = [
    ['Share of your remaining working life', r.shareOfWorkingLife == null ? 'n/a (retired)' : pct(r.shareOfWorkingLife)],
    ['Share of your remaining waking life', r.shareOfAwakeLife == null ? 'n/a' : pct(r.shareOfAwakeLife)],
    ['Estimated take-home pay', `${gbp(pay.takeHome)} a year`],
    ['Tax and National Insurance', `${gbp(pay.incomeTax + pay.ni)} a year`],
    ['Your hourly rate on paper', `£${r.paidHourlyRate.toFixed(2)}`],
    ['Your real hourly rate (incl. commute)', `£${r.trueHourlyRate.toFixed(2)}`],
    ['Estimated years left', `${r.yearsLeft.toFixed(1)} (to age ${r.deathAge.toFixed(0)})`],
  ];
  dl.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

$('run').addEventListener('click', run);
$('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });
