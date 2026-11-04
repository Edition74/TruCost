const $ = (id) => document.getElementById(id);
const radio = (name) => document.querySelector(`input[name=${name}]:checked`).value;
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

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

// ---------- Pay period: converts the current figure when the period changes ----------
const PERIODS = {
  hourly:  { label: 'Pay per hour',  min: 5,     max: 150,    step: 0.5 },
  daily:   { label: 'Pay per day',   min: 40,    max: 1200,   step: 5 },
  weekly:  { label: 'Pay per week',  min: 200,   max: 6000,   step: 10 },
  monthly: { label: 'Pay per month', min: 800,   max: 25000,  step: 50 },
  annual:  { label: 'Pay per year',  min: 10000, max: 300000, step: 500 },
};

function bindPeriod(radioName, earnId, hoursId) {
  const b = { period: 'annual', earn: fields[earnId], hours: fields[hoursId] };
  b.apply = (period, amount) => {
    const p = PERIODS[period];
    Object.assign(b.earn.cfg, { min: p.min, max: p.max, step: p.step });
    b.earn.label.textContent = p.label;
    document.querySelector(`input[name=${radioName}][value=${period}]`).checked = true;
    b.earn.set(amount);
    b.period = period;
  };
  document.querySelectorAll(`input[name=${radioName}]`).forEach((r) =>
    r.addEventListener('change', () => {
      const hpw = b.hours.get() || 40, hol = fields.holiday.get() ?? 5;
      const annual = annualise(b.earn.get() || 0, b.period, hpw, hol);
      const p = PERIODS[r.value];
      b.apply(r.value, Number((Math.round(fromAnnual(annual, r.value, hpw, hol) / p.step) * p.step).toFixed(2)));
    })
  );
  return b;
}
const main = bindPeriod('period', 'earn', 'hours');
const custom = bindPeriod('cperiod', 'cEarn', 'cHours');

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
const priceText = (price, freq) => gbp(price) + (freq === 'monthly' ? ' a month' : freq === 'yearly' ? ' a year' : '');

// ---------- Storage (this device only) ----------
const ITEMS_KEY = 'trucost.items.v1';
const PROFILE_KEY = 'trucost.profile.v1';
const PROFILE_FIELDS = ['hours', 'age', 'commute', 'holiday', 'otherPct', 'retire'];
let items = [];

function readStore(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: list lasts for this visit */ }
}
function saveProfile() {
  writeStore(PROFILE_KEY, {
    period: main.period, earn: fields.earn.get(), sex: $('sex').value, lifeExp: $('lifeExp').value,
    ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, fields[k].get()])),
  });
}
function loadProfile() {
  const d = readStore(PROFILE_KEY, null);
  if (!d) return;
  PROFILE_FIELDS.forEach((k) => { if (d[k] != null) fields[k].set(d[k]); });
  if (PERIODS[d.period] && d.earn != null) main.apply(d.period, d.earn);
  if (d.sex) $('sex').value = d.sex;
  if (d.lifeExp) $('lifeExp').value = d.lifeExp;
}

// ---------- Calculation helpers ----------
function profile() {
  const age = fields.age.get(), hours = fields.hours.get(), earn = fields.earn.get();
  if (!age || !(hours > 0) || !(earn > 0)) return null;
  const lifeExp = parseFloat($('lifeExp').value);
  return {
    age, hours, earn, period: main.period,
    holiday: fields.holiday.get() ?? 5, commute: fields.commute.get() ?? 0,
    otherPct: fields.otherPct.get() ?? 0, retire: fields.retire.get() ?? 67,
    sex: $('sex').value, lifeExp: Number.isFinite(lifeExp) ? lifeExp : null,
  };
}

// spec: { price, frequency, pay? } where pay overrides current earnings for this item
function computeItem(spec, p) {
  const pay = spec.pay;
  const hours = pay ? pay.hours : p.hours;
  const gross = pay
    ? annualise(pay.amount, pay.period, pay.hours, p.holiday)
    : annualise(p.earn, p.period, p.hours, p.holiday);
  const tax = estimateTakeHome(gross, p.otherPct);
  const r = calculate({
    price: spec.price, frequency: spec.frequency,
    takeHomeAnnual: tax.takeHome, hoursPerWeek: hours,
    commuteHoursPerWeek: p.commute, holidayWeeks: p.holiday,
    age: p.age, sex: p.sex, retirementAge: p.retire, lifeExpectancyOverride: p.lifeExp,
  });
  return { r, tax, gross };
}

// ---------- Result ----------
function run() {
  const price = fields.price.get(), box = $('result');
  box.hidden = false;
  const p = profile();

  const missing = [];
  if (!(price > 0)) missing.push('price');
  if (!fields.age.get()) missing.push('age');
  if (!(fields.earn.get() > 0)) missing.push('pay');
  if (!(fields.hours.get() > 0)) missing.push('weekly hours');
  if (missing.length || !p) {
    $('bigNumber').textContent = 'Missing details';
    $('bigSub').textContent = `Add your ${missing.join(', ')} and press the button again.`;
    $('tiles').innerHTML = $('lifebar').innerHTML = $('details').innerHTML = '';
    $('saveCard').hidden = true;
    return;
  }
  $('saveCard').hidden = false;

  const frequency = radio('frequency');
  const { r, tax } = computeItem({ price, frequency }, p);

  $('bigNumber').textContent = fmtDuration(r.hoursOfLife) + ' of your life';
  $('bigSub').textContent = frequency !== 'once'
    ? `${priceText(price, frequency)} for ${r.horizonYears.toFixed(0)} years is ${gbp(r.totalCost)} in total`
    : `The time it takes to earn ${gbp(r.totalCost)} after tax`;

  $('tiles').innerHTML = [
    [(r.workingDays < 10 ? r.workingDays.toFixed(1) : Math.round(r.workingDays).toLocaleString('en-GB')), 'working days'],
    [r.shareOfWorkingLife == null ? 'n/a' : pct(r.shareOfWorkingLife), 'of your working life left'],
    [r.shareOfAwakeLife == null ? 'n/a' : pct(r.shareOfAwakeLife), 'of your waking life left'],
  ].map(([v, l]) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`).join('');

  // Life bar: remaining years split into working and retired; accent slice is this purchase.
  const workPct = (r.workingYearsLeft / (r.yearsLeft || 1)) * 100;
  const slice = r.shareOfWorkingLife == null ? 0 : Math.min(100, Math.max(1.5, r.shareOfWorkingLife * 100));
  const retireAt = Math.round(p.age + r.workingYearsLeft);
  $('lifebar').innerHTML = workPct > 0
    ? `<div class="lifebar"><div class="lb-work" style="width:${workPct}%"><div class="lb-cost" style="width:${slice}%"></div></div></div>` +
      `<div class="lb-ticks"><span>Now, ${p.age}</span><span>Retire, ${retireAt}</span><span>About ${Math.round(r.deathAge)}</span></div>` +
      `<p class="lb-note">The bright slice is this purchase, out of the working years you have left.</p>`
    : `<p class="lb-note">You are past retirement age, so only your waking life is compared.</p>`;

  $('details').innerHTML = [
    ['Estimated take-home pay', `${gbp(tax.takeHome)} a year`],
    ['Tax and National Insurance', `${gbp(tax.incomeTax + tax.ni)} a year`],
    ['Your hourly rate on paper', `£${r.paidHourlyRate.toFixed(2)}`],
    ['Your real hourly rate, with commute', `£${r.trueHourlyRate.toFixed(2)}`],
    ['Estimated years left', `${r.yearsLeft.toFixed(1)}, to age ${r.deathAge.toFixed(0)}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  updatePreview();
  box.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------- Save card ----------
function payOverride() {
  if ($('useCurrent').checked) return null;
  return { period: custom.period, amount: custom.earn.get(), hours: custom.hours.get() };
}
function overrideValid(o) { return !o || (o.amount > 0 && o.hours > 0); }

function updatePreview() {
  const p = profile(), price = fields.price.get(), o = payOverride();
  const el = $('savePreview');
  if (!p || !(price > 0) || !overrideValid(o)) { el.textContent = ''; return; }
  const { r } = computeItem({ price, frequency: radio('frequency'), pay: o }, p);
  el.textContent = `${o ? 'At that pay' : 'At your current pay'} this costs ${fmtDuration(r.hoursOfLife)} of your life.`;
}

let customSynced = false;
$('useCurrent').addEventListener('change', () => {
  const useCurrent = $('useCurrent').checked;
  $('customPay').hidden = useCurrent;
  if (!useCurrent && !customSynced) {
    customSynced = true;
    custom.hours.set(fields.hours.get() || 40);
    custom.apply(main.period, fields.earn.get() || PERIODS[main.period].min);
  }
  updatePreview();
});
document.querySelectorAll('input[name=status]').forEach((r) =>
  r.addEventListener('change', () => { $('dateRow').hidden = radio('status') !== 'bought'; })
);
$('saveCard').addEventListener('input', updatePreview);
$('saveCard').addEventListener('change', updatePreview);

function save() {
  const msg = $('saveMsg'), p = profile(), price = fields.price.get(), name = $('itemName').value.trim();
  const o = payOverride();
  if (!p) { msg.textContent = 'Add your age, pay and weekly hours first.'; return; }
  if (!(price > 0)) { msg.textContent = 'Add a price first.'; return; }
  if (!name) { msg.textContent = 'Give it a name so you can find it later.'; $('itemName').focus(); return; }
  if (!overrideValid(o)) { msg.textContent = 'Add the pay and weekly hours you had at the time.'; return; }
  items.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, price, frequency: radio('frequency'), status: radio('status'),
    date: radio('status') === 'bought' && $('itemDate').value ? $('itemDate').value : null,
    pay: o,
  });
  writeStore(ITEMS_KEY, items);
  $('itemName').value = '';
  msg.textContent = 'Added to your list.';
  renderList();
}
$('save').addEventListener('click', save);

// ---------- List ----------
function renderList() {
  const p = profile();
  $('clearBtn').hidden = !items.length;
  $('filterSeg').hidden = !items.length;
  if (!items.length) {
    $('totals').innerHTML = '';
    $('list').innerHTML = '<li class="empty">Nothing saved yet. Calculate a price, then add it here to keep a running total of your time.</li>';
    return;
  }
  if (!p) {
    $('totals').innerHTML = '';
    $('list').innerHTML = '<li class="empty">Fill in your age, pay and weekly hours above to see what your saved items cost.</li>';
    return;
  }
  const rows = items.map((it) => ({ it, ...computeItem(it, p) }));
  const sum = (arr) => arr.reduce((s, x) => s + x.r.hoursOfLife, 0);
  const bought = rows.filter((x) => x.it.status === 'bought');
  const planned = rows.filter((x) => x.it.status === 'planned');
  const total = sum(rows);
  const probe = computeItem({ price: 1, frequency: 'once' }, p).r;
  const workingHoursLeft = (p.hours + p.commute) * (52 - p.holiday) * probe.workingYearsLeft;
  const share = workingHoursLeft > 0 ? ` · ${pct(total / workingHoursLeft)} of your working life left` : '';

  $('totals').innerHTML =
    `<div class="hero totals"><div class="hero-label">Your list in total</div>` +
    `<div class="big">${fmtDuration(total)}</div>` +
    `<div class="sub">${rows.length} item${rows.length === 1 ? '' : 's'}${share}</div>` +
    `<div class="tiles two">` +
    `<div class="tile"><b>${fmtDuration(sum(bought))}</b><span>Already bought (${bought.length})</span></div>` +
    `<div class="tile"><b>${fmtDuration(sum(planned))}</b><span>Planned (${planned.length})</span></div>` +
    `</div></div>`;

  const filter = radio('filter');
  const shown = rows.filter((x) => filter === 'all' || x.it.status === filter);
  $('list').innerHTML = shown.length ? shown.map(({ it, r, gross }) => {
    const when = it.date ? ' · ' + new Date(it.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
    const payNote = it.pay ? ` · on ${gbp(gross)} a year pay` : '';
    return `<li class="item"><div><div class="item-name">${esc(it.name)}</div>` +
      `<div class="item-meta"><span class="st ${it.status}">${it.status === 'bought' ? 'Bought' : 'Planned'}</span>` +
      `${priceText(it.price, it.frequency)}${when}${payNote}</div></div>` +
      `<div class="item-cost">${fmtDuration(r.hoursOfLife)}</div>` +
      `<div class="item-actions">` +
      `${it.status === 'planned' ? `<button type="button" data-act="bought" data-id="${it.id}">Mark as bought</button>` : ''}` +
      `<button type="button" data-act="remove" data-id="${it.id}">Remove</button></div></li>`;
  }).join('') : '<li class="empty">No items in this view.</li>';
}

$('list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const i = items.findIndex((x) => x.id === btn.dataset.id);
  if (i < 0) return;
  if (btn.dataset.act === 'remove') items.splice(i, 1);
  if (btn.dataset.act === 'bought') {
    items[i].status = 'bought';
    items[i].date = items[i].date || new Date().toISOString().slice(0, 10);
  }
  writeStore(ITEMS_KEY, items);
  renderList();
});
document.querySelectorAll('input[name=filter]').forEach((r) => r.addEventListener('change', renderList));

let clearTimer = null;
$('clearBtn').addEventListener('click', () => {
  const btn = $('clearBtn');
  if (btn.dataset.armed) {
    items = []; writeStore(ITEMS_KEY, items);
    delete btn.dataset.armed; btn.textContent = 'Clear list'; clearTimeout(clearTimer);
    renderList();
    return;
  }
  btn.dataset.armed = '1'; btn.textContent = 'Tap again to remove everything';
  clearTimer = setTimeout(() => { delete btn.dataset.armed; btn.textContent = 'Clear list'; }, 4000);
});

// ---------- Wiring ----------
function onProfileChange() { saveProfile(); renderList(); }
$('form').addEventListener('input', onProfileChange);
$('form').addEventListener('change', onProfileChange);
$('run').addEventListener('click', run);
$('form').addEventListener('submit', (e) => { e.preventDefault(); run(); });

loadProfile();
items = readStore(ITEMS_KEY, []);
$('saveCard').hidden = true;
renderList();
