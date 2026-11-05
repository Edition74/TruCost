// TruCost calculation engine. Pure functions, no DOM, so it can be tested and reused.
//
// Core idea: money is a claim on your time. A price is converted into the hours of
// your life you must work to earn it, then compared with the life you have left.

// Period life expectancy e(x): years still expected at age x, UK, ONS national life
// tables 2021 to 2023 (https://www.ons.gov.uk/peoplepopulationandcommunity/birthsdeathsandmarriages/lifeexpectancies).
// Linear interpolation between the published ages. "Period" figures describe today's
// mortality rates; younger people will on average live somewhat longer, so this is
// a cautious estimate. Review when ONS publishes a new release.
const LIFE_TABLE = {
  male:   [[0, 78.82], [10, 69.25], [20, 59.38], [30, 49.71], [40, 40.21], [50, 31.09], [60, 22.51], [65, 18.51], [70, 14.79], [80, 8.31], [90, 3.90]],
  female: [[0, 82.77], [10, 73.13], [20, 63.21], [30, 53.36], [40, 43.65], [50, 34.23], [60, 25.23], [65, 20.96], [70, 16.92], [80, 9.68], [90, 4.55]],
};

function remainingYears(age, sex) {
  if (sex !== 'male' && sex !== 'female') {
    return (remainingYears(age, 'male') + remainingYears(age, 'female')) / 2;
  }
  const t = LIFE_TABLE[sex];
  if (age <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (age <= t[i][0]) {
      const [x0, y0] = t[i - 1], [x1, y1] = t[i];
      return y0 + ((y1 - y0) * (age - x0)) / (x1 - x0);
    }
  }
  const [xl, yl] = t[t.length - 1];
  return Math.max(1, yl - 0.35 * (age - xl)); // beyond 90: a gentle taper
}

function expectedAgeAtDeath(age, sex) {
  return age + remainingYears(age, sex);
}


// Rough UK (England, Wales, NI) employee tax estimate from gross salary.
// Income tax: 12,570 personal allowance (tapered above 100k), 20% to 37,700 of
// taxable income, 40% to 125,140, 45% above. Employee NI: 8% between 12,570 and
// 50,270, 2% above. Ignores pension, student loan, Scottish rates and benefits.
// Thresholds are frozen but should be reviewed each April.
function estimateTakeHome(gross, extraDeductionPct = 0) {
  const PA_BASE = 12570;
  const pa = gross > 100000 ? Math.max(0, PA_BASE - (gross - 100000) / 2) : PA_BASE;
  const taxable = Math.max(0, gross - pa);
  const basic = Math.min(taxable, 37700) * 0.20;
  const higher = Math.max(0, Math.min(taxable, 125140) - 37700) * 0.40;
  const additional = Math.max(0, taxable - 125140) * 0.45;
  const incomeTax = basic + higher + additional;
  const ni = Math.max(0, Math.min(gross, 50270) - 12570) * 0.08 + Math.max(0, gross - 50270) * 0.02;
  const other = gross * (extraDeductionPct / 100);
  return { incomeTax, ni, other, takeHome: gross - incomeTax - ni - other };
}

// Convert a pay figure in any period to an annual figure, and back.
// Weekly, monthly and yearly pay is treated as paid all year (holiday is paid).
// Hourly and daily pay is treated as paid only for the weeks actually worked.
function annualise(amount, period, hoursPerWeek, holidayWeeks = 5) {
  const weeks = 52 - holidayWeeks;
  switch (period) {
    case 'hourly':  return amount * hoursPerWeek * weeks;
    case 'daily':   return amount * (hoursPerWeek / 8) * weeks;
    case 'weekly':  return amount * 52;
    case 'monthly': return amount * 12;
    default:        return amount;
  }
}
function fromAnnual(annual, period, hoursPerWeek, holidayWeeks = 5) {
  const weeks = 52 - holidayWeeks;
  switch (period) {
    case 'hourly':  return annual / (hoursPerWeek * weeks);
    case 'daily':   return annual / ((hoursPerWeek / 8) * weeks);
    case 'weekly':  return annual / 52;
    case 'monthly': return annual / 12;
    default:        return annual;
  }
}

const HOURS_AWAKE_PER_DAY = 16;
const WEEKS_PER_YEAR = 52;

function calculate(input) {
  const {
    price,                 // amount in currency
    frequency = 'once',    // 'once' | 'monthly' | 'yearly'
    takeHomeAnnual,        // annual take-home (after tax) income
    hoursPerWeek,          // paid hours per week
    commuteHoursPerWeek = 0, // unpaid hours tied to work (commute, prep)
    holidayWeeks = 5,      // weeks off per year
    age,
    sex = 'average',
    retirementAge = 67,
    lifeExpectancyOverride = null, // expected age at death, if the user knows better
    yearsOfUse = null,     // how long a one-off purchase will be used
  } = input;

  const deathAge = lifeExpectancyOverride ?? expectedAgeAtDeath(age, sex);
  const yearsLeft = Math.max(0, deathAge - age);
  const workingYearsLeft = Math.max(0, Math.min(retirementAge, deathAge) - age);

  const workWeeks = WEEKS_PER_YEAR - holidayWeeks;
  const paidHoursPerYear = hoursPerWeek * workWeeks;
  const lifeHoursPerYearAtWork = (hoursPerWeek + commuteHoursPerWeek) * workWeeks;

  // Two rates: what you are nominally paid, and what you really earn per hour
  // of life you hand over to work (including the commute).
  const paidHourlyRate = takeHomeAnnual / paidHoursPerYear;
  const trueHourlyRate = takeHomeAnnual / lifeHoursPerYearAtWork;

  // Total spend over the horizon for recurring costs.
  let totalCost = price;
  let horizonYears = 0;
  if (frequency === 'monthly') { horizonYears = yearsLeft; totalCost = price * 12 * yearsLeft; }
  if (frequency === 'yearly')  { horizonYears = yearsLeft; totalCost = price * yearsLeft; }

  const hoursOfLife = totalCost / trueHourlyRate;       // life hours spent earning it
  const hoursOfWork = totalCost / paidHourlyRate;       // paid hours only

  const workingLifeHoursLeft = lifeHoursPerYearAtWork * workingYearsLeft;
  const awakeHoursLeft = yearsLeft * 365.25 * HOURS_AWAKE_PER_DAY;

  return {
    deathAge, yearsLeft, workingYearsLeft,
    paidHourlyRate, trueHourlyRate,
    totalCost, horizonYears,
    hoursOfLife, hoursOfWork,
    workingDays: hoursOfLife / 8,
    hoursPerYearOfUse: frequency === 'once' && yearsOfUse > 0 ? hoursOfLife / yearsOfUse : null,
    shareOfWorkingLife: workingLifeHoursLeft > 0 ? hoursOfLife / workingLifeHoursLeft : null,
    shareOfAwakeLife: awakeHoursLeft > 0 ? hoursOfLife / awakeHoursLeft : null,
  };
}

if (typeof module !== 'undefined') module.exports = { calculate, expectedAgeAtDeath, estimateTakeHome, annualise, fromAnnual };
