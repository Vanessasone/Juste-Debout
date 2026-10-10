const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(path, requireFn) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require: requireFn, Date });
  return exports;
}
const early = load('src/lib/earlyBird.ts');
const sales = load('src/lib/ticketSalesPresentation.ts', () => early);
const live = Date.parse('2026-10-10T14:00:00+02:00');
const end = Date.parse('2026-10-10T21:00:00+02:00');
for (const [code, base, expected] of [['day_sat', 4000, 3500], ['day_sun', 4000, 3500], ['two_days', 7000, 6000]]) {
  const product = { code, price_cents: base, promo_eligible: true };
  assert.equal(sales.displayedTicketPrice(product, ' 48 ', live), expected);
  assert.equal(sales.checkoutPromo(product, '48', live), '48');
  assert.equal(sales.displayedTicketPrice(product, '48', end - 1), expected);
  assert.equal(sales.displayedTicketPrice(product, '48', end), base);
  assert.equal(sales.checkoutPromo(product, '48', end), '');
  assert.equal(sales.displayedTicketPrice(product, 'OTHER', live), base);
  assert.equal(sales.checkoutPromo(product, 'OTHER', live), 'OTHER');
  assert.equal(sales.displayedTicketPrice(product, '', live), base);
  assert.equal(sales.displayedTicketPrice(product, '48', early.EARLY_BIRD_START - 1), base);
}
for (const [code, price] of [['vip_sat', 10000], ['black_card', 39700], ['family_sun', 10000], ['three_days', 10500], ['four_days', 13000]]) {
  const product = { code, price_cents: price, promo_eligible: true };
  assert.equal(sales.displayedTicketPrice(product, '48', live), price);
  assert.equal(sales.checkoutPromo(product, '48', live), '');
}
assert.equal(sales.displayedTicketPrice({ code: 'day_sat', price_cents: 4000, promo_eligible: false }, '48', live), 4000);
for (const [code, group] of [['three_days', 'standard'], ['four_days', 'standard'], ['vip_two_days', 'vip'], ['black_card', 'black'], ['family_two_days', 'family'], ['mjc_sun', 'family']]) assert.equal(sales.ticketGroup(code), group);
console.log('Ticket sales presentation: early bird boundaries, eligibility, code preservation and product groups passed.');
