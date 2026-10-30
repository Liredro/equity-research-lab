const assert = require('node:assert/strict');
const test = require('node:test');
const M = require('../dist/assets/model.js');

test('reference model returns five dated years and financial identities hold', () => {
  const r = M.calculate(M.DEFAULTS);
  assert.equal(r.years.length, 5);
  assert.deepEqual(r.years.map(y => y.year), [2026, 2027, 2028, 2029, 2030]);
  r.years.forEach((y, i) => {
    assert.ok(Number.isFinite(y.fcf));
    assert.ok(Math.abs(y.fcf - (y.nopat + y.da - y.capex - y.deltaNwc)) < 1e-10);
    assert.ok(Math.abs(y.pvFcf - y.fcf / (1 + r.assumptions.wacc/100)**(i+1)) < 1e-10);
  });
  assert.ok(Math.abs(r.pvCashFlows + r.pvTerminal - r.enterpriseValue) < 1e-8);
  assert.ok(Math.abs(r.enterpriseValue - r.netDebt - r.equityValue) < 1e-8);
  assert.ok(Math.abs(r.equityValue/r.assumptions.shares - r.price) < 1e-8);
});
test('higher WACC reduces the default positive-cash-flow valuation', () => {
  assert.ok(M.calculate({ wacc: 10 }).price < M.calculate({ wacc: 9 }).price);
});
test('higher terminal growth increases the default valuation', () => {
  assert.ok(M.calculate({ terminalGrowth: 3 }).price > M.calculate({ terminalGrowth: 2 }).price);
});
test('higher EBIT margin increases value, all else fixed', () => {
  assert.ok(M.calculate({ margin: 27 }).price > M.calculate({ margin: 24 }).price);
});
test('more debt reduces price per share by the correct amount', () => {
  const before = M.calculate({ debt: 310 }).price;
  const after = M.calculate({ debt: 420 }).price;
  assert.ok(Math.abs((before - after) - 1) < 1e-10);
});
test('rejects invalid terminal-growth spread and share count', () => {
  assert.throws(() => M.calculate({ wacc: 2, terminalGrowth: 3 }), /WACC must exceed/);
  assert.throws(() => M.calculate({ shares: 0 }), /Shares outstanding/);
  assert.throws(() => M.calculate({ wacc: Infinity }), /finite number/);
});
test('working capital releases cash as revenue contracts', () => {
  const r = M.calculate({ growth: -4, fade: 0 });
  assert.ok(r.years.every(y => y.deltaNwc < 0));
});
test('sensitivity centre matches current model price', () => {
  const grid = M.sensitivity({ ...M.DEFAULTS });
  assert.equal(grid.cells.length, 5);
  assert.ok(Math.abs(grid.cells[2][2] - M.calculate().price) < 1e-10);
});
test('bear / base / bull premade outcomes are correctly ordered for defaults', () => {
  const prices = ['bear','base','bull'].map(k => M.calculate(M.SCENARIOS[k]).price);
  assert.ok(prices[0] < prices[1] && prices[1] < prices[2]);
});


test('each fictional company has its own model and historical financials', () => {
  const names = Object.keys(M.COMPANIES);
  assert.deepEqual(names, ['nstr', 'solr', 'harb']);
  const valuations = names.map(id => {
    const c = M.COMPANIES[id];
    assert.equal(c.historical.length, 5);
    const result = M.calculate(c.defaults, c.historical);
    assert.ok(Number.isFinite(result.price));
    assert.ok(result.years[0].year === 2026);
    return result.price;
  });
  assert.equal(new Set(valuations.map(v => v.toFixed(2))).size, names.length);
});

test('company-specific scenario presets preserve bear/base/bull progression', () => {
  for (const [id, c] of Object.entries(M.COMPANIES)) {
    const price = which => M.calculate(M.companyScenario(id, which), c.historical).price;
    assert.ok(price('bear') < price('base'), `${id}: bear below base`);
    assert.ok(price('base') < price('bull'), `${id}: base below bull`);
  }
});
