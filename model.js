/* Financial logic intentionally independent of the DOM for testing and reuse. */
(function (root, factory) {
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  if (root) root.ValuationModel = model;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HISTORICAL = [
    { year: 2021, revenue: 760, ebitMargin: 18.2, fcf: 91 },
    { year: 2022, revenue: 885, ebitMargin: 19.0, fcf: 107 },
    { year: 2023, revenue: 1010, ebitMargin: 20.1, fcf: 133 },
    { year: 2024, revenue: 1120, ebitMargin: 21.4, fcf: 151 },
    { year: 2025, revenue: 1250, ebitMargin: 22.8, fcf: 168 }
  ];

  // All monetary values are USD millions; shares are millions; percentages in percentage points.
  const DEFAULTS = Object.freeze({
    growth: 9, fade: 1, margin: 24, marginStep: 0.25,
    tax: 25, depreciation: 4, capex: 6, workingCapital: 1.5,
    wacc: 9, terminalGrowth: 2.5, cash: 180, debt: 310,
    shares: 110, marketPrice: 32
  });

  const SCENARIOS = Object.freeze({
    bear: Object.freeze({ growth: 5, fade: 1.25, margin: 21.5, marginStep: 0, wacc: 10.5, terminalGrowth: 2 }),
    base: Object.freeze({ ...DEFAULTS }),
    bull: Object.freeze({ growth: 13, fade: 0.5, margin: 26, marginStep: 0.5, wacc: 8, terminalGrowth: 3 })
  });

  // Three distinct fictional company profiles. None represent listed securities.
  const COMPANIES = Object.freeze({
    nstr: Object.freeze({
      name: 'Northstar Systems', ticker: 'NSTR', sector: 'Software / Technology',
      description: 'A growing enterprise software company with expanding operating margins.',
      historical: HISTORICAL,
      defaults: DEFAULTS
    }),
    solr: Object.freeze({
      name: 'Solstice Retail', ticker: 'SOLR', sector: 'Consumer / Retail',
      description: 'A mature retailer with narrower margins and more capital-intensive operations.',
      historical: Object.freeze([
        { year: 2021, revenue: 4150, ebitMargin: 5.8, fcf: 125 },
        { year: 2022, revenue: 4320, ebitMargin: 6.2, fcf: 139 },
        { year: 2023, revenue: 4580, ebitMargin: 6.8, fcf: 171 },
        { year: 2024, revenue: 4790, ebitMargin: 7.1, fcf: 187 },
        { year: 2025, revenue: 5060, ebitMargin: 7.5, fcf: 201 }
      ]),
      defaults: Object.freeze({ ...DEFAULTS, growth: 5, fade: 0.65, margin: 8, marginStep: 0.15, tax: 25, depreciation: 3.5, capex: 4.8, workingCapital: 3, wacc: 9.5, terminalGrowth: 2, cash: 320, debt: 920, shares: 200, marketPrice: 13 })
    }),
    harb: Object.freeze({
      name: 'Harbor Utilities', ticker: 'HARB', sector: 'Infrastructure / Utilities',
      description: 'A relatively stable utility with substantial reinvestment and debt.',
      historical: Object.freeze([
        { year: 2021, revenue: 2080, ebitMargin: 16.6, fcf: 121 },
        { year: 2022, revenue: 2200, ebitMargin: 17.1, fcf: 129 },
        { year: 2023, revenue: 2300, ebitMargin: 17.6, fcf: 148 },
        { year: 2024, revenue: 2410, ebitMargin: 18.2, fcf: 166 },
        { year: 2025, revenue: 2550, ebitMargin: 18.5, fcf: 172 }
      ]),
      defaults: Object.freeze({ ...DEFAULTS, growth: 4, fade: 0.45, margin: 19, marginStep: 0.15, tax: 26, depreciation: 8, capex: 10, workingCapital: 1, wacc: 7.5, terminalGrowth: 2, cash: 380, debt: 1450, shares: 180, marketPrice: 18 })
    })
  });

  function companyScenario(company, which) {
    if (!COMPANIES[company]) throw new Error('Unknown demonstration company.');
    if (!['bear', 'base', 'bull'].includes(which)) throw new Error('Unknown scenario.');
    const base = COMPANIES[company].defaults;
    if (which === 'base') return { ...base };
    const modifier = which === 'bull' ? 1 : -1;
    return {
      ...base,
      growth: base.growth + modifier * 4,
      fade: Math.max(0, base.fade - modifier * .35),
      margin: base.margin + modifier * 2,
      marginStep: base.marginStep + modifier * .2,
      wacc: base.wacc - modifier * 1.25,
      terminalGrowth: base.terminalGrowth + modifier * .5
    };
  }

  const keys = Object.keys(DEFAULTS);
  function validate(a) {
    if (!a || keys.some(k => !Number.isFinite(a[k]))) throw new Error('Every assumption must be a finite number.');
    if (a.shares <= 0) throw new Error('Shares outstanding must be greater than zero.');
    if (a.wacc <= a.terminalGrowth) throw new Error('WACC must exceed terminal growth.');
    if (a.wacc <= 0 || a.terminalGrowth < -10) throw new Error('Discount or terminal growth assumptions are invalid.');
    if (a.tax < 0 || a.tax > 100) throw new Error('Tax rate must be between 0% and 100%.');
    if (a.margin < -100 || a.margin > 100) throw new Error('EBIT margin must be between -100% and 100%.');
    if (a.depreciation < 0 || a.capex < 0 || a.workingCapital < 0) throw new Error('Cash-flow rates cannot be negative.');
    if (a.cash < 0 || a.debt < 0 || a.marketPrice <= 0) throw new Error('Cash, debt or market price assumptions are invalid.');
    if (a.fade < 0 || a.fade > 50) throw new Error('Growth taper must be between 0 and 50 percentage points.');
    if (a.growth < -100 || a.growth > 100) throw new Error('Growth assumption out of range.');
    return a;
  }

  function calculate(raw, historical = HISTORICAL) {
    const a = validate({ ...DEFAULTS, ...raw });
    const initial = historical[historical.length - 1];
    if (!initial || !Number.isFinite(initial.revenue) || initial.revenue <= 0) throw new Error('Historical revenue must be positive.');
    let previousRevenue = initial.revenue;
    let pvCashFlows = 0;
    const years = Array.from({ length: 5 }, (_, index) => {
      const year = index + 1;
      const growth = a.growth - index * a.fade;
      const revenue = previousRevenue * (1 + growth / 100);
      if (revenue <= 0) throw new Error('Forecast revenue must be positive.');
      const margin = a.margin + index * a.marginStep;
      const ebit = revenue * margin / 100;
      const taxExpense = Math.max(0, ebit) * a.tax / 100;
      const nopat = ebit - taxExpense;
      const da = revenue * a.depreciation / 100;
      const capex = revenue * a.capex / 100;
      // Working-capital investment is expressed as a share of the revenue increase.
      // A revenue contraction releases working capital (negative investment).
      const deltaNwc = (revenue - previousRevenue) * a.workingCapital / 100;
      const fcf = nopat + da - capex - deltaNwc;
      const discount = Math.pow(1 + a.wacc / 100, year);
      const pvFcf = fcf / discount;
      pvCashFlows += pvFcf;
      previousRevenue = revenue;
      return { year: initial.year + year, growth, revenue, margin, ebit, taxExpense, nopat, da, capex, deltaNwc, fcf, pvFcf };
    });
    const finalFCF = years[4].fcf;
    const nextFCF = finalFCF * (1 + a.terminalGrowth / 100);
    const terminalValue = nextFCF / ((a.wacc - a.terminalGrowth) / 100);
    const pvTerminal = terminalValue / Math.pow(1 + a.wacc / 100, 5);
    const enterpriseValue = pvCashFlows + pvTerminal;
    const netDebt = a.debt - a.cash;
    const equityValue = enterpriseValue - netDebt;
    const price = equityValue / a.shares;
    const upside = (price / a.marketPrice - 1) * 100;
    const terminalWeight = pvTerminal / enterpriseValue * 100;
    return { assumptions: a, years, pvCashFlows, nextFCF, terminalValue, pvTerminal, enterpriseValue, netDebt, equityValue, price, upside, terminalWeight };
  }

  function withScenario(which, baseline = DEFAULTS) {
    if (!SCENARIOS[which]) throw new Error('Unknown scenario.');
    return { ...baseline, ...SCENARIOS[which] };
  }

  function sensitivity(a, historical = HISTORICAL) {
    // Five by five: WACC columns and terminal-growth rows; relative to current assumptions.
    const waccs = [-1, -.5, 0, .5, 1].map(d => a.wacc + d);
    const growths = [-1, -.5, 0, .5, 1].map(d => a.terminalGrowth + d);
    return { waccs, growths, cells: growths.map(g => waccs.map(w => {
      try { return calculate({ ...a, wacc: w, terminalGrowth: g }, historical).price; }
      catch (_) { return null; }
    })) };
  }

  return { HISTORICAL, DEFAULTS, SCENARIOS, COMPANIES, companyScenario, calculate, validate, sensitivity, withScenario };
});
