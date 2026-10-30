# 📊 Equity Research Lab

A browser-based workspace for financial statement analysis, discounted cash flow valuation and scenario comparison. Built with **HTML, CSS and JavaScript**.

Import annual financial statements, verify the data, explore historical performance and translate your assumptions into a five-year valuation. All financial data is processed locally in your browser; no backend, API key or account is required.

## ✨ Features

- **Financial statement import:** CSV and multi-worksheet XLSX files, line-item mapping, units and sign adjustments, source references and manual D&A review.
- **Accounting checks:** reconcile gross profit, operating profit and the balance sheet; flag discrepancies and unavailable checks.
- **Historical analysis:** revenue growth, EBITDA, margins, cash conversion, simplified ROIC and net leverage, with inspectable calculations.
- **DCF workbench:** five editable forecast years, D&A, capital expenditure and working capital schedules, plus an enterprise-to-equity bridge.
- **WACC calculator:** CAPM cost of equity, cost of debt, tax and capital structure assumptions.
- **Scenario comparison:** save up to six cases, explore WACC/terminal-growth sensitivity and inspect the effect of individual assumption changes.
- **Exports:** download forecast CSVs and save or restore complete analysis projects as JSON.

## 🚀 Getting started

Download and extract the repository, then open **`dist/index.html`** in a modern browser. No installation or build step is required to use the application.

Start with the included **fictional Aurora Technology** sample, or import your own statements.

1. Select **Import financials** and upload a CSV or XLSX file.
2. Review the suggested mappings, reporting years, units, signs and source rows.
3. Confirm the mappings and investigate any accounting discrepancies.
4. Explore historical results in **Financial analysis**.
5. Open the valuation workbench, review forecast assumptions and confirm the equity bridge.
6. Compare cases and select **Save project** to download your work.

**Save before refreshing or importing another company.** Unsaved work is lost on refresh; a new import replaces the current company and clears its scenarios. Saved projects contain the selected source rows, assumptions and cases, rather than the entire uploaded workbook.

## 📂 Preparing financial statements

Use annual tables with **financial metrics in rows and years in columns**. Headers such as `2025`, `FY2025` and `2025A` are supported. A sample is provided in [`dist/samples/aurora-financials.csv`](dist/samples/aurora-financials.csv).

- Import requires at least two annual revenue figures. Other missing figures remain unavailable and may prevent specific calculations.
- Confirm units for each mapped line. Financial amounts and share counts are normalised independently to millions; share prices remain per-share.
- Use a consistent currency and reporting basis. Currency conversion and restatement adjustments are not automatic.
- Costs, D&A and CapEx use positive magnitudes. Review ambiguous D&A disclosures and enter verified annual figures with a source reference where necessary.
- XLSX formulas must contain cached results: the importer does not calculate workbook formulas.
- PDFs, encrypted workbooks, quarterly statements and complex merged headers require preparation outside the application.

The importer uses accounting terminology rules and analyst confirmation; it does not interpret arbitrary annual reports using AI.

<details>
<summary>Technical import limits</summary>

Maximum upload: 8 MB. Up to 12 historical years and 4,000 candidate financial rows. CSV files support up to 1,000 non-empty records; XLSX worksheets support up to 100 source columns. Accounting reconciliation tolerance is the greater of 0.01 million and 0.5% of the compared balances.

</details>

## 🧮 Financial methodology

The DCF forecasts unlevered free cash flow, discounts it at WACC using year-end discounting, and applies a Gordon growth terminal value.

| Calculation | Definition |
| --- | --- |
| EBITDA | EBIT + D&A |
| Cash flow after CapEx | Reported operating cash flow − CapEx |
| Forecast UFCF | EBIT − max(EBIT, 0) × tax rate + D&A − CapEx − change in working capital |
| Working capital investment | Year-specific assumption × change in revenue |
| Terminal value | Final-year UFCF × (1 + terminal growth) / (WACC − terminal growth) |
| Equity value | Enterprise value + cash − debt − non-controlling interests − preferred capital + other non-operating assets |
| Cost of equity | Risk-free rate + levered beta × equity risk premium |
| WACC | Cost of equity × equity weight + cost of debt × (1 − tax rate) × debt weight |

Cash flow after CapEx is distinct from the unlevered cash flow used in the DCF. WACC weights should reflect market capital structure.

**Cash, debt, diluted shares and other equity-bridge adjustments require explicit review and confirmation.** Editing a bridge input invalidates that confirmation. A market share price is optional: it is used to calculate upside, not intrinsic value.

<details>
<summary>Historical ratios and starting assumptions</summary>

- Cash conversion = (operating cash flow − CapEx) / net income; unavailable for non-positive net income.
- Net leverage = (debt − cash) / EBITDA; unavailable for non-positive EBITDA.
- Simplified ROIC = EBIT × (1 − 25% assumed tax) / average invested capital, where invested capital = debt + total equity − cash. It requires positive average capital and uses adjacent available reporting balances. This fixed historical tax assumption is separate from the forecast tax input.
- CAGR uses elapsed fiscal years. Year-on-year growth is unavailable for non-consecutive years.
- Starting forecast ratios use historical figures where available. Otherwise, EBIT margin of 20%, D&A/revenue of 4% and CapEx/revenue of 6% are explicit assumptions.
- Initial growth uses annualised latest revenue growth, capped between −50% and 40%, then fades by 1.5 percentage points each year.
- Default working capital investment is 10% of the change in revenue; default WACC is 9%, forecast tax is 25% and terminal growth is 2.5%.

These are editable modelling assumptions, not predictions. Falling revenue releases working capital under this model. Pension, lease and excess-cash adjustments are not automatic; review all material adjustments and the appropriate diluted share count.

</details>

## 🗂️ Project structure

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Application entry point |
| `dist/assets/app.js` | Interface, workflow and project save/restore |
| `dist/assets/research.js` | Financial analysis, validation, DCF and WACC calculations |
| `dist/assets/importer.js` | CSV/XLSX parsing |
| `dist/assets/styles.css` | Application styling |
| `dist/assets/model.js` | Earlier model retained for regression tests; not loaded by the interface |
| `dist/samples/` | Fictional sample financial statements |
| `tests/` | Automated tests |

## ✅ Tests

Node.js and npm are required **only to run the automated tests**:

```bash
npm ci
npm test
```

The suite contains 42 tests covering import parsing, financial calculations, D&A review, equity-bridge confirmation and optional market prices. Prepared Apple FY2024–FY2025 statements were also checked through the importer, including D&A recognition and six accounting reconciliations. This does not constitute independent Excel validation of a complete real-company DCF.

## 🌐 Deployment

Serve the contents of `dist/` using a static host. For GitHub Pages, configure a Pages workflow to publish `dist/`. Asset paths are relative and no application server is required.

If your copy displays a **Download source code** footer link, ensure its target exists or replace it with your repository link; the source ZIP itself is not included in the downloadable source package.

## 🔎 Scope and limitations

This is a financial research and portfolio prototype. It does not include live market data, company lookup, trading comparables, PDF extraction, formula-linked Excel exports or a fully integrated three-statement forecast.

Valuations depend on analyst assumptions and source definitions. The simplified terminal cash-flow approach, negative terminal cash flow and heavy reliance on terminal value require particular review. Check imported figures and material adjustments before interpreting results. **Not investment advice.**

## 📦 Dependencies

[JSZip](https://stuk.github.io/jszip/) is bundled for XLSX reading; its [licence](dist/assets/JSZIP-LICENSE.md) is included. `@xmldom/xmldom` is used only for Node.js importer tests; browsers provide their own XML parser.
