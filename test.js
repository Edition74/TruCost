const assert = require('assert');
const { calculate, expectedAgeAtDeath, estimateTakeHome, annualise, fromAnnual } = require('./calc');

// Survivor adjustment is in the expected range
assert(Math.abs(expectedAgeAtDeath(40, 'male') - 81.5) < 0.5);
assert(Math.abs(expectedAgeAtDeath(65, 'male') - 85.6) < 0.5);

// 40h/wk, 47 working weeks, £47,000 take-home, no commute => £25/hr
const base = { price: 1000, takeHomeAnnual: 47000, hoursPerWeek: 40, commuteHoursPerWeek: 0,
               holidayWeeks: 5, age: 45, sex: 'average', retirementAge: 67 };
let r = calculate(base);
assert.strictEqual(Math.round(r.paidHourlyRate), 25);
assert.strictEqual(Math.round(r.hoursOfLife), 40);

// Commute makes the real rate lower and the life cost higher
r = calculate({ ...base, commuteHoursPerWeek: 10 });
assert(r.trueHourlyRate < r.paidHourlyRate && r.hoursOfLife > 40);

// Recurring costs scale with years left
const once = calculate(base).totalCost;
const monthly = calculate({ ...base, price: 50, frequency: 'monthly' });
assert(monthly.totalCost > once * 0.5 && monthly.horizonYears > 30);

// Retired: no working life left, share is null, no NaN
r = calculate({ ...base, age: 70 });
assert.strictEqual(r.shareOfWorkingLife, null);

// Tax: £50,000 gross => tax 7,486 + NI 2,994.40 => take-home 39,519.60
const p = estimateTakeHome(50000);
assert(Math.abs(p.takeHome - 39519.6) < 0.5);
assert.strictEqual(estimateTakeHome(10000).takeHome, 10000); // under allowance
assert(estimateTakeHome(150000).takeHome < 150000 * 0.65);   // additional rate bites

// Pay conversion: £25/hr, 40h, 47 weeks => £47,000; round-trips for every period
assert.strictEqual(annualise(25, 'hourly', 40, 5), 47000);
assert.strictEqual(annualise(200, 'daily', 40, 5), 47000);
assert.strictEqual(annualise(1000, 'weekly', 40, 5), 52000);
assert.strictEqual(annualise(4000, 'monthly', 40, 5), 48000);
for (const p of ['hourly', 'daily', 'weekly', 'monthly', 'annual']) {
  assert(Math.abs(fromAnnual(annualise(37, p, 37.5, 6), p, 37.5, 6) - 37) < 1e-9);
}

console.log('All tests passed');
