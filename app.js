const $ = (id) => document.getElementById(id);
const radio = (name) => document.querySelector(`input[name=${name}]:checked`).value;
const setRadio = (name, value) => {
  const r = document.querySelector(`input[name=${name}][value=${value}]`);
  if (r) r.checked = true;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduceMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
const lamp = (id, on) => $(id).classList.toggle('on', on);
const says = (html) => { $('says').innerHTML = html; };

// ---------- Dials: a rotary knob with a typeable LCD in the centre ----------
const START = -135, SWEEP = 270, END = START + SWEEP, TICKS = 40;
const SVGNS = 'http://www.w3.org/2000/svg';
const fields = {};
const sig = (v, n) => Number(v.toPrecision(n));
const compact = (n) => (n >= 1000 ? Number((n / 1000).toFixed(1)) + 'k' : String(n));

function buildDial(el) {
  const d = el.dataset;
  const f = { cfg: { min: +d.min, max: +d.max, step: +d.step || 1, log: 'log' in d }, unit: d.unit || '' };
  el.classList.add('dial');
  if (d.size) el.classList.add(d.size);
  el.innerHTML =
    `<div class="dial-body">` +
      `<div class="bezel"></div><div class="face"></div>` +
      `<svg class="scale" viewBox="0 0 200 200" aria-hidden="true"></svg>` +
      `<div class="knob" tabindex="0" role="slider" aria-label="${d.label}"><i class="notch"></i></div>` +
      `<div class="lcd"><input id="${d.id}" type="number" inputmode="decimal" step="any"><small>${f.unit}</small></div>` +
      `<span class="lim lo"></span><span class="lim hi"></span>` +
    `</div>` +
    `<label class="cap" for="${d.id}">${d.label}</label>`;
  const svg = el.querySelector('svg');
  const lo = el.querySelector('.lo'), hi = el.querySelector('.hi');
  f.knob = el.querySelector('.knob');
  f.num = el.querySelector('input');
  f.label = el.querySelector('.cap');

  const ticks = [];
  for (let i = 0; i <= TICKS; i++) {
    const a = ((START + (SWEEP * i) / TICKS) * Math.PI) / 180;
    const major = i % 10 === 0, r1 = major ? 76 : 80, r2 = 87;
    const ln = document.createElementNS(SVGNS, 'line');
    ln.setAttribute('x1', (100 + r1 * Math.sin(a)).toFixed(2));
    ln.setAttribute('y1', (100 - r1 * Math.cos(a)).toFixed(2));
    ln.setAttribute('x2', (100 + r2 * Math.sin(a)).toFixed(2));
    ln.setAttribute('y2', (100 - r2 * Math.cos(a)).toFixed(2));
    ln.setAttribute('class', major ? 't maj' : 't');
    svg.appendChild(ln);
    ticks.push(ln);
  }

  // value <-> position (0..1000). Price uses a log scale so small and large prices are both easy.
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
  f.get = () => { const v = parseFloat(f.num.value); return Number.isFinite(v) ? v : null; };
  f.pos = () => { const v = f.get(); return v == null ? 0 : f.toPos(v) / 1000; };
  f.paint = () => {
    const pos = f.pos();
    f.knob.style.transform = `rotate(${START + SWEEP * pos}deg)`;
    ticks.forEach((t, i) => t.classList.toggle('on', i / TICKS <= pos + 1e-9));
    f.knob.setAttribute('aria-valuenow', f.num.value || f.cfg.min);
  };
  f.set = (v) => { f.num.value = v; f.paint(); };
  f.emit = () => f.num.dispatchEvent(new Event('input', { bubbles: true }));
  f.limits = () => {
    const pre = f.unit === '£' ? '£' : '';
    lo.textContent = pre + compact(f.cfg.min);
    hi.textContent = pre + compact(f.cfg.max);
    f.knob.setAttribute('aria-valuemin', f.cfg.min);
    f.knob.setAttribute('aria-valuemax', f.cfg.max);
  };
  f.setLabel = (t) => { f.label.textContent = t; f.knob.setAttribute('aria-label', t); };

  // Turning: relative circular drag, stops at the ends of the sweep.
  let drag = null;
  f.knob.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = f.knob.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    drag = { cx, cy, last: Math.atan2(e.clientY - cy, e.clientX - cx), angle: START + SWEEP * f.pos() };
    try { if (f.knob.setPointerCapture && e.pointerId != null) f.knob.setPointerCapture(e.pointerId); } catch { /* capture is optional */ }
    f.knob.classList.add('grab');
  });
  f.knob.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const a = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
    let delta = a - drag.last;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    drag.last = a;
    drag.angle = Math.min(END, Math.max(START, drag.angle + (delta * 180) / Math.PI));
    const v = f.fromPos(((drag.angle - START) / SWEEP) * 1000);
    if (String(v) !== f.num.value) { f.set(v); f.emit(); }
  });
  const stop = () => { drag = null; f.knob.classList.remove('grab'); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => f.knob.addEventListener(t, stop));

  // Keyboard on the knob
  f.knob.addEventListener('keydown', (e) => {
    const { min, max, step, log } = f.cfg;
    const cur = f.get() ?? min;
    const big = e.shiftKey || e.key === 'PageUp' || e.key === 'PageDown';
    let v = null;
    if (['ArrowUp', 'ArrowRight', 'PageUp'].includes(e.key)) {
      v = log ? f.fromPos(Math.min(1000, f.toPos(cur) + (big ? 80 : 8))) : cur + step * (big ? 10 : 1);
    } else if (['ArrowDown', 'ArrowLeft', 'PageDown'].includes(e.key)) {
      v = log ? f.fromPos(Math.max(0, f.toPos(cur) - (big ? 80 : 8))) : cur - step * (big ? 10 : 1);
    } else if (e.key === 'Home') v = min;
    else if (e.key === 'End') v = max;
    if (v == null) return;
    e.preventDefault();
    f.set(Number(Math.min(max, Math.max(min, v)).toFixed(2)));
    f.emit();
  });

  // Typing into the LCD
  f.num.addEventListener('input', f.paint);
  f.num.addEventListener('focus', () => f.num.select());
  f.num.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); f.num.blur(); } });

  f.limits();
  f.set(+d.value);
  fields[d.id] = f;
}
document.querySelectorAll('[data-id]').forEach(buildDial);

// ---------- Pay period: converts the current figure when the period changes ----------
const PERIODS = {
  hourly:  { label: 'Pay per hour',  min: 5,     max: 150,    step: 0.5 },
  daily:   { label: 'Pay per day',   min: 40,    max: 1200,   step: 5 },
  weekly:  { label: 'Pay per week',  min: 200,   max: 6000,   step: 10 },
  monthly: { label: 'Pay per month', min: 800,   max: 25000,  step: 50 },
  annual:  { label: 'Pay per year',  min: 10000, max: 300000, step: 500 },
};
const PER = { hourly: 'an hour', daily: 'a day', weekly: 'a week', monthly: 'a month', annual: 'a year' };

function bindPeriod(radioName, earnId, hoursId) {
  const b = { period: 'annual', earn: fields[earnId], hours: fields[hoursId] };
  b.apply = (period, amount) => {
    const p = PERIODS[period];
    Object.assign(b.earn.cfg, { min: p.min, max: p.max, step: p.step });
    b.earn.setLabel(p.label);
    b.earn.limits();
    setRadio(radioName, period);
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
function durationParts(hours) {
  if (hours <= 0) return { n: '0', u: 'minutes' };
  if (hours < 1) { const m = Math.max(1, Math.round(hours * 60)); return { n: String(m), u: m === 1 ? 'minute' : 'minutes' }; }
  if (hours < 48) return { n: hours.toFixed(1), u: 'hours' };
  const days = hours / 8;
  if (days < 60) return { n: days.toFixed(1), u: 'working days' };
  const years = hours / (8 * 5 * 52);
  if (years < 1) return { n: (days / 21.7).toFixed(1), u: 'working months' };
  return { n: years.toFixed(1), u: 'working years' };
}
const fmtDuration = (h) => { const { n, u } = durationParts(h); return `${n} ${u}`; };
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
    period: main.period, earn: fields.earn.get(), sex: radio('sex'), lifeExp: $('lifeExp').value,
    ...Object.fromEntries(PROFILE_FIELDS.map((k) => [k, fields[k].get()])),
  });
}
function loadProfile() {
  const d = readStore(PROFILE_KEY, null);
  if (!d) return;
  PROFILE_FIELDS.forEach((k) => { if (d[k] != null) fields[k].set(d[k]); });
  if (PERIODS[d.period] && d.earn != null) main.apply(d.period, d.earn);
  if (d.sex) setRadio('sex', d.sex);
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
    sex: radio('sex'), lifeExp: Number.isFinite(lifeExp) ? lifeExp : null,
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

// ---------- Output screen ----------
const SEGS = 40;
let runToken = 0;

function reveal() {
  $('screenWrap').scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
}

// ---------- Mascot poses ----------
// Extra artwork is optional: drop mascot-<pose>.webp next to index.html (the build
// embeds any that exist). A missing or broken file falls back to the idle pose.
const POSES = { idle: $('mascot').getAttribute('src'), thinking: 'mascot-thinking.webp', shrug: 'mascot-shrug.webp', cheer: 'mascot-cheer.webp', shock: 'mascot-shock.webp' };
function pose(name) {
  const img = $('mascot');
  if (!img || img.dataset.pose === name) return;
  img.dataset.pose = name;
  img.onerror = () => { img.onerror = null; img.src = POSES.idle; };
  img.src = POSES[name] || POSES.idle;
  if (!reduceMotion()) { img.classList.remove('pop'); void img.offsetWidth; img.classList.add('pop'); }
}
const poseFor = (hours) => (hours >= 160 ? 'shock' : hours < 8 ? 'cheer' : 'idle');

function renderResult(p, price) {
  const frequency = radio('frequency');
  const { r, tax } = computeItem({ price, frequency }, p);
  const { n, u } = durationParts(r.hoursOfLife);
  const sub = frequency !== 'once'
    ? `${priceText(price, frequency)} for ${r.horizonYears.toFixed(0)} years is ${gbp(r.totalCost)} in total.`
    : `The time it takes to earn ${gbp(r.totalCost)} after tax.`;
  const days = r.workingDays < 10 ? r.workingDays.toFixed(1) : Math.round(r.workingDays).toLocaleString('en-GB');
  const reads = [
    [days, 'Working days'],
    [r.shareOfWorkingLife == null ? 'n/a' : pct(r.shareOfWorkingLife), 'Of working life left'],
    [r.shareOfAwakeLife == null ? 'n/a' : pct(r.shareOfAwakeLife), 'Of waking life left'],
  ].map(([v, l]) => `<div class="read"><b>${v}</b><span>${l}</span></div>`).join('');

  let bar;
  if (r.workingYearsLeft > 0) {
    const lit = Math.min(SEGS, Math.max(1, Math.ceil(r.shareOfWorkingLife * SEGS)));
    const retireAt = Math.round(p.age + r.workingYearsLeft);
    bar = `<div class="bar-title">Your remaining working life</div>` +
      `<div class="segbar" role="img" aria-label="This purchase uses ${pct(r.shareOfWorkingLife)} of your remaining working life">` +
      Array.from({ length: SEGS }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('') + `</div>` +
      `<div class="bar-ticks"><span>Now, ${p.age}</span><span>Retire, ${retireAt}</span></div>` +
      `<p class="bar-note">Each block is ${100 / SEGS}% of the working life you have left. Lit blocks are this purchase.</p>`;
  } else {
    bar = `<p class="bar-note">You are past retirement age, so only your waking life is compared.</p>`;
  }

  const rows = [
    ['Take-home pay', `${gbp(tax.takeHome)} a year`],
    ['Tax and NI', `${gbp(tax.incomeTax + tax.ni)} a year`],
    ['Hourly rate on paper', `£${r.paidHourlyRate.toFixed(2)}`],
    ['Real hourly rate', `£${r.trueHourlyRate.toFixed(2)}`],
    ['Years left', `${r.yearsLeft.toFixed(1)}, to age ${r.deathAge.toFixed(0)}`],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  $('out').innerHTML =
    `<div class="ln dim">&gt; ITEM ${esc(priceText(price, frequency))}</div>` +
    `<div class="ln dim">&gt; PAY ${gbp(p.earn)} ${PER[p.period]} BEFORE TAX</div>` +
    `<div class="out-label">This costs you</div>` +
    `<div class="out-big"><span class="n">${n}</span><span class="u">${u}</span></div>` +
    `<div class="out-sub">of your life. ${sub}</div>` +
    `<div class="reads">${reads}</div>${bar}<dl class="rows">${rows}</dl>`;
  says(`<span>${priceText(price, frequency)} on the tag.</span><em>${n} ${u} of your life.</em>`);
  pose(poseFor(r.hoursOfLife));
  $('scrState').textContent = 'Ready';
}

function run() {
  const token = ++runToken;
  const price = fields.price.get(), p = profile();
  const missing = [];
  if (!(price > 0)) missing.push('price');
  if (!fields.age.get()) missing.push('age');
  if (!(fields.earn.get() > 0)) missing.push('pay');
  if (!(fields.hours.get() > 0)) missing.push('weekly hours');
  lamp('lampErr', false);
  lamp('lampBusy', false);
  reveal();

  if (missing.length || !p) {
    lamp('lampErr', true);
    says('<span>Oi!</span><em>A dial is missing.</em>');
    pose('shrug');
    $('scrState').textContent = 'Error';
    $('out').innerHTML =
      `<div class="ln err">&gt; ERROR: MISSING ${esc(missing.join(', ').toUpperCase())}</div>` +
      `<div class="ln dim">&gt; SET THE DIALS AND PRESS GENERATE AGAIN<span class="cur"></span></div>`;
    $('saveCard').hidden = true;
    return;
  }
  const finish = () => {
    if (token !== runToken) return;
    lamp('lampBusy', false);
    renderResult(p, price);
    $('saveCard').hidden = false;
    updatePreview();
  };
  if (reduceMotion()) { finish(); return; }
  lamp('lampBusy', true);
  says('<span>Crunching&hellip;</span><em>Hold tight.</em>');
  pose('thinking');
  $('scrState').textContent = 'Computing';
  $('out').innerHTML = `<div class="ln">&gt; COMPUTING TRUE COST</div><div class="prog"><i></i></div>`;
  setTimeout(finish, 450);
}

// ---------- Save panel ----------
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
  el.textContent = `> ${o ? 'AT THAT PAY' : 'AT YOUR CURRENT PAY'} THIS COSTS ${fmtDuration(r.hoursOfLife).toUpperCase()} OF YOUR LIFE`;
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
  if (!p) { msg.textContent = '> ERROR: ADD AGE, PAY AND WEEKLY HOURS FIRST'; return; }
  if (!(price > 0)) { msg.textContent = '> ERROR: ADD A PRICE FIRST'; return; }
  if (!name) { msg.textContent = '> ERROR: GIVE IT A NAME SO YOU CAN FIND IT LATER'; $('itemName').focus(); return; }
  if (!overrideValid(o)) { msg.textContent = '> ERROR: ADD THE PAY AND HOURS YOU HAD AT THE TIME'; return; }
  items.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name, price, frequency: radio('frequency'), status: radio('status'),
    date: radio('status') === 'bought' && $('itemDate').value ? $('itemDate').value : null,
    pay: o,
  });
  writeStore(ITEMS_KEY, items);
  $('itemName').value = '';
  msg.textContent = '> STORED TO MEMORY';
  renderList();
}
$('save').addEventListener('click', save);

// ---------- Memory bank ----------
const compareIds = new Set(); // this visit only, not saved

function renderCompare(rows) {
  const box = $('compare');
  const picked = rows.filter((x) => compareIds.has(x.it.id)).sort((a, b) => a.r.hoursOfLife - b.r.hoursOfLife);
  if (picked.length < 2) {
    box.hidden = !compareIds.size;
    box.innerHTML = compareIds.size
      ? '<div class="scr-head"><span>Compare</span><span>1 chosen</span></div><div class="ln dim">&gt; CHOOSE ONE MORE ITEM TO COMPARE<span class="cur"></span></div>'
      : '';
    return;
  }
  const max = picked[picked.length - 1].r.hoursOfLife || 1;
  const low = picked[0], high = picked[picked.length - 1];
  const diff = durationParts(high.r.hoursOfLife - low.r.hoursOfLife);
  box.hidden = false;
  box.innerHTML =
    `<div class="scr-head"><span>Compare</span><span>${picked.length} chosen</span></div>` +
    picked.map(({ it, r }, i) =>
      `<div class="cmp-row${i === 0 ? ' best' : ''}"><div class="cmp-top"><span class="cmp-name">${esc(it.name)}</span><b>${fmtDuration(r.hoursOfLife)}</b></div>` +
      `<div class="cmp-bar"><i style="width:${Math.max(3, (r.hoursOfLife / max) * 100).toFixed(1)}%"></i></div>` +
      `<div class="cmp-meta">${esc(priceText(it.price, it.frequency))}</div></div>`).join('') +
    `<div class="cmp-sum">&gt; <b>${esc(low.it.name)}</b> costs ${diff.n} ${diff.u} less of your life than <b>${esc(high.it.name)}</b>.</div>` +
    `<button type="button" class="linkbtn" data-act="cmpclear">Clear comparison</button>`;
}

function renderList() {
  const p = profile();
  $('clearBtn').hidden = !items.length;
  $('filterSeg').hidden = !items.length;
  lamp('lampMem', items.length > 0);
  $('memCount').textContent = `${items.length} item${items.length === 1 ? '' : 's'}`;
  if (!items.length) {
    $('totals').innerHTML = '';
    $('list').innerHTML = '<li class="empty">&gt; MEMORY EMPTY. GENERATE A COST, THEN STORE IT HERE TO KEEP A RUNNING TOTAL OF YOUR TIME.</li>';
    return;
  }
  if (!p) {
    $('totals').innerHTML = '';
    $('list').innerHTML = '<li class="empty">&gt; SET YOUR AGE, PAY AND WEEKLY HOURS ABOVE TO SEE WHAT YOUR STORED ITEMS COST.</li>';
    return;
  }
  const rows = items.map((it) => ({ it, ...computeItem(it, p) }));
  const sum = (arr) => arr.reduce((s, x) => s + x.r.hoursOfLife, 0);
  const bought = rows.filter((x) => x.it.status === 'bought');
  const planned = rows.filter((x) => x.it.status === 'planned');
  const total = sum(rows);
  const probe = computeItem({ price: 1, frequency: 'once' }, p).r;
  const workingHoursLeft = (p.hours + p.commute) * (52 - p.holiday) * probe.workingYearsLeft;
  const share = workingHoursLeft > 0 ? `, ${pct(total / workingHoursLeft)} of your working life left` : '';
  const t = durationParts(total);

  $('totals').innerHTML =
    `<div class="out-label" style="margin-top:0">List total</div>` +
    `<div class="out-big sm"><span class="n">${t.n}</span><span class="u">${t.u}</span></div>` +
    `<div class="out-sub">${rows.length} item${rows.length === 1 ? '' : 's'}${share}</div>` +
    `<div class="reads two">` +
    `<div class="read"><b>${fmtDuration(sum(bought))}</b><span>Already bought (${bought.length})</span></div>` +
    `<div class="read"><b>${fmtDuration(sum(planned))}</b><span>Planned (${planned.length})</span></div></div>`;

  for (const id of [...compareIds]) if (!items.some((x) => x.id === id)) compareIds.delete(id);
  renderCompare(rows);

  const filter = radio('filter');
  const shown = rows.filter((x) => filter === 'all' || x.it.status === filter);
  $('list').innerHTML = shown.length ? shown.map(({ it, r, gross }) => {
    const when = it.date ? ' · ' + new Date(it.date).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '';
    const payNote = it.pay ? ` · on ${gbp(gross)} a year pay` : '';
    return `<li class="item"><div><div class="item-name">${esc(it.name)}</div>` +
      `<div class="item-meta"><span class="st ${it.status}">${it.status === 'bought' ? 'Bought' : 'Planned'}</span>` +
      `${esc(priceText(it.price, it.frequency))}${when}${payNote}</div></div>` +
      `<div class="item-cost">${fmtDuration(r.hoursOfLife)}</div>` +
      `<div class="item-actions">` +
      `<button type="button" data-act="cmp" data-id="${it.id}" aria-pressed="${compareIds.has(it.id)}">${compareIds.has(it.id) ? 'Comparing' : 'Compare'}</button>` +
      `${it.status === 'planned' ? `<button type="button" data-act="bought" data-id="${it.id}">Mark as bought</button>` : ''}` +
      `<button type="button" data-act="remove" data-id="${it.id}">Remove</button></div></li>`;
  }).join('') : '<li class="empty">&gt; NOTHING IN THIS VIEW.</li>';
}

$('compare').addEventListener('click', (e) => {
  if (e.target.closest('button[data-act=cmpclear]')) { compareIds.clear(); renderList(); }
});
$('list').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'cmp') {
    if (compareIds.has(btn.dataset.id)) compareIds.delete(btn.dataset.id); else compareIds.add(btn.dataset.id);
    renderList();
    return;
  }
  const i = items.findIndex((x) => x.id === btn.dataset.id);
  if (i < 0) return;
  if (btn.dataset.act === 'remove') { items.splice(i, 1); compareIds.delete(btn.dataset.id); }
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
renderList();
