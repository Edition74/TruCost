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

function render() {
  const price = num('price');
  const age = num('age');
  const takeHome = num('takeHome');
  const hours = num('hours');
  const ready = price > 0 && age && takeHome > 0 && hours > 0;

  const big = $('bigNumber'), sub = $('bigSub'), dl = $('details');
  if (!ready) {
    big.textContent = 'Enter a price';
    sub.textContent = 'Add the price, your age, take-home pay and weekly hours.';
    dl.innerHTML = '';
    return;
  }

  const r = calculate({
    price,
    frequency: $('frequency').value,
    takeHomeAnnual: takeHome,
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
    ['Your hourly rate on paper', `£${r.paidHourlyRate.toFixed(2)}`],
    ['Your real hourly rate (incl. commute)', `£${r.trueHourlyRate.toFixed(2)}`],
    ['Estimated years left', `${r.yearsLeft.toFixed(1)} (to age ${r.deathAge.toFixed(0)})`],
  ];
  dl.innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
}

document.querySelectorAll('input, select').forEach((el) => el.addEventListener('input', render));
render();
