# TruCost

Converts the price of a product or service into what it really costs *you*: hours of your working life, and the share of the life you have left.

## How it works (v0.1)

1. Price (one-off, or monthly/yearly for life)
2. Your take-home pay and hours give a paid hourly rate. Commute and work-related hours give a lower, real hourly rate.
3. Price divided by real hourly rate gives the hours of life spent earning it.
4. That is compared with remaining working life and remaining waking life, based on age, sex and an estimated life expectancy.

## Run it

No build step. Open `index.html` in a browser. To test the maths: `node test.js`.

## Roadmap

- Replace the life-expectancy approximation with real ONS life tables
- Demographic and lifestyle adjustments (region, smoking, health) as optional inputs
- Tax estimator so users can enter gross pay
- Inflation and investment-return option (what a recurring cost would have grown to)
- Save and compare purchases


## Install on a phone (Android)

The app is an installable web app. Once it is hosted (GitHub Pages: Settings, Pages, deploy from branch `main`, folder `/ (root)`), open the link in Chrome on the phone, then menu, "Install app" (or "Add to Home Screen"). It works offline and keeps your list on that phone only. Use Export list before switching phones or clearing browser data.

When any file changes, bump `VERSION` in `sw.js` so installed copies refresh.
