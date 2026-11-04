// TruCost calculation engine. Pure functions, no DOM, so it can be tested and reused.
//
// Core idea: money is a claim on your time. A price is converted into the hours of
// your life you must work to earn it, then compared with the life you have left.

// Approximate life expectancy at birth (UK-ish, period figures). Editable by the user.
const LIFE_EXPECTANCY_AT_BIRTH = { male: 79, female: 83, average: 81 };

// Survivor bonus: someone who has already reached age `a` is expected to live
// longer than the at-birth figure. 0.00156 * a^2 fits UK cohort tables roughly
// (+2.5y at 40, +6.6y at 65, +10y at 80). This is a placeholder until we plug in
// real life tables (ONS) per sex, and later by demographic factors.
function expectedAgeAtDeath(age, sex) {
  const base = LIFE_EXPECTANCY_AT_BIRTH[sex] ?? LIFE_EXPECTANCY_AT_BIRTH.average;
  return base + 0.00156 * age * age;
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
    shareOfWorkingLife: workingLifeHoursLeft > 0 ? hoursOfLife / workingLifeHoursLeft : null,
    shareOfAwakeLife: awakeHoursLeft > 0 ? hoursOfLife / awakeHoursLeft : null,
  };
}

if (typeof module !== 'undefined') module.exports = { calculate, expectedAgeAtDeath, estimateTakeHome };
