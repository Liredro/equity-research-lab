# Equity Research Lab

An interactive financial statement analysis and valuation application built with HTML, CSS and JavaScript. Import annual financial statements, review accounting checks, explore historical performance and build a five-year discounted cash flow valuation.

All financial data is processed in your browser. No API key, backend or application account is required. The included Aurora Technology dataset is fictional.

## Features

- Professional navy workspace, restrained blue/violet/green/amber accents, responsive navigation and separate analysis, verification, valuation and scenario views.
- Financial analysis: historical revenue, EBITDA, EBIT, gross and operating margins, CFO less CapEx, cash conversion, simplified ROIC, net leverage and revenue CAGR. Missing values stay unavailable.
- Multi-worksheet import: CSV and XLSX annual tables, FY-prefixed headers, exact terminology aliases, ambiguous-match review, raw-source preview, independent line-item units, explicit sign reversal and source register. Import requires two annual revenues, not nine valuation fields.
- Reconciliation: revenue less cost of revenue against gross profit; gross profit less operating expenses against EBIT; assets against liabilities plus equity. Each check is passed, review or unavailable. Rounding tolerance is max(0.01 million, 0.5% of the compared balances).
- Five editable forecast years, D&A / CapEx / working capital schedules, CAPM WACC builder, expanded enterprise-to-equity bridge, formula explanations and single-input value-change attribution.
- Save up to six named cases, restore cases, WACC × terminal-growth sensitivity, downloadable JSON projects and forecast CSV.

## Run locally

Download and extract the source ZIP, then open `dist/index.html` in a modern browser. You can also serve the application with Python:

```bash
python3 -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. The application itself has no build step or runtime package installation.

## Workflow

1. Explore the clearly marked fictional Aurora sample.
2. Choose **Import financials**. Upload a CSV or XLSX workbook, or use the sample statements.
3. Inspect source rows, review every suggested mapping, choose each line's units, and explicitly reverse signs where needed. Select the reporting currency (no FX conversion).
4. Confirm the mappings. Financial analysis and accounting checks now use the imported data.
5. Open the valuation workbench. Review the forecast assumptions, diluted shares and equity bridge, then explicitly confirm the bridge. A reference market price is optional. Edit an input then press Tab or click away to recalculate.
6. Save named scenarios. Use **Save project** to download all data, provenance, assumptions and cases as JSON. **Open project** restores it. Unsaved work is lost on refresh.

New imports replace the current company and clear its scenarios; download the existing project first if it is needed. Input files are parsed in browser memory and are not uploaded to a data service. The download contains the selected source rows, not the entire original workbook.

## Import conventions and limits

Maximum file size: 8 MB. Up to 12 historical years and 4,000 candidate financial rows. CSV parser supports up to 1,000 non-empty records. XLSX parser supports at most 100 source columns. Annual year headers must be plain 2025, FY2025 or 2025A; Excel dates, interim/quarterly periods, merged/multi-level financial headers, PDF and encrypted workbooks require preparation first. Only cached formula results are read; workbook formulas are not evaluated.

Financial amounts and shares are normalised independently to millions. Prices remain per-share. Review weighted-average versus current diluted share counts for the valuation. Units and fiscal definitions require user confirmation; they are not inferred from arbitrary annual-report prose. The importer recognises exact normalised terminology; it is not an AI interpreter. Use one consistent currency and annual reporting basis across selected worksheets. There is no automatic currency conversion or restatement adjustment.

Cost of revenue, operating expenses, D&A and CapEx use positive magnitudes. ΔNWC uses positive for investment and negative for release. CFO classification varies across accounting regimes; ensure it represents your intended operating cash-flow definition. Ambiguous matches are left unselected. No missing reported figure is silently derived.

D&A review flags combined disclosures such as “Depreciation, amortization, and other”, separate components and accumulated balances rather than silently mapping them. Enter verified annual D&A in millions with a source reference and explicit confirmation. These entries replace only the D&A mapping; blank years stay unavailable. The source note is retained in saved projects and formula inspection. Supporting-note extraction and automatic component summation are not implemented.

## Calculation definitions

- EBITDA = EBIT + D&A (review the operating scope of D&A).
- Cash flow after CapEx = reported CFO − CapEx. This is not the DCF's unlevered FCF.
- Cash conversion = (CFO − CapEx) / net income, unavailable for non-positive net income.
- ROIC = EBIT × (1 − 25% assumed tax) / average invested capital. Invested capital = debt + total equity − cash. Uses adjacent available reporting balances and requires positive average capital. This is a simplified proxy, not a fully adjusted ROIC calculation.
- Net leverage = (debt − cash) / EBITDA, unavailable for non-positive EBITDA.
- CAGR uses elapsed fiscal years. YoY growth is unavailable where years are non-consecutive.
- Forecast UFCF = EBIT − max(EBIT, 0) × tax + D&A − CapEx − ΔNWC.
- ΔNWC = year-specific rate × change in revenue. Falling revenue releases working capital.
- End-year discounting; Gordon growth terminal value = final-year UFCF × (1+g)/(WACC−g).
- Equity = enterprise value + cash − debt − non-controlling interests − preferred capital + other non-operating assets. No automatic pension, lease or excess-cash adjustment.
- WACC = Ke × E/(D+E) + Kd × (1−tax) × D/(D+E); Ke = risk-free rate + levered beta × equity risk premium. Weights should reflect market capital structure.

Forecast starting ratios use historical values where available. Otherwise margin 20%, D&A 4% and CapEx 6% are explicit assumptions. Initial growth uses annualised latest revenue growth, capped between −50% and 40%, and fades 1.5 percentage points yearly. ΔNWC defaults to 10% of revenue change, WACC to 9%, tax to 25% and terminal growth to 2.5%. Missing cash/debt remain blank and prevent valuation. All equity-bridge inputs (cash, debt, NCI, preferred capital, other assets and diluted shares) require explicit confirmation; editing one invalidates that confirmation. Zeros for additional adjustments must also be reviewed. Confirmation persists in saved projects and cases; older projects require review. Diluted shares are required, but a reference market price is optional: intrinsic value is calculated without it and upside remains unavailable. Historical ROIC tax is independently fixed at 25% and labelled.

## Scope

The application focuses on financial analysis, transparent valuation and scenario comparison. Not yet implemented: trading comparables, a multi-method football field, formula-linked XLSX export, AI PDF extraction, real-company lookup, live market feeds, server accounts or full three-statement modelling. A CSV export is not a genuine Excel model. The terminal period still uses a simplified perpetuity; negative terminal FCF and heavy terminal-value reliance require review.

This is a research/portfolio prototype and is not investment advice. The sample is fictional and is not a listed security.

## Source and tests

- `dist/assets/research.js`: pure import interpretation, ratios, checks, DCF and WACC engine.
- `dist/assets/app.js`: interactive workflow and local project persistence.
- `dist/assets/importer.js`: CSV/XLSX reader with preserved XLSX row references.
- `dist/assets/model.js`: earlier model retained for regression tests, not loaded by the current interface.
- `tests/`: 42 automated tests, covering import parsing, financial calculations, D&A review, equity-bridge confirmation and optional market prices.

Run `npm ci` then `npm test` using Node.js. The XML DOM dependency is used only by the Node XLSX test; browsers supply DOMParser themselves. All runtime assets are bundled locally. JSZip's licence is included.

## Repository structure

```text
dist/
  index.html          Application entry point
  assets/             Styles, financial engine, UI and bundled dependencies
  samples/            Fictional annual financial statements
  downloads/          Downloadable source archive on the hosted site
tests/                Automated Node.js tests
package.json          Test command and development dependency
README.md             Setup, methodology and limitations
```

## Static hosting and GitHub

Use `equity-research-lab` as the repository name. Keep this README, the package files, `tests/` and `dist/` in the repository so visitors can inspect and run the project.

The deployable website is the contents of `dist/`: configure your static host to serve that directory. For GitHub Pages, deploy `dist/` as the Pages artifact, or copy its contents to the root of your chosen publishing branch. The website uses relative asset paths and does not need a server-side application.

The hosted source download is `dist/downloads/equity-research-lab.zip`. If publishing a modified copy, regenerate that archive or remove its footer link so visitors do not download stale code.

## Verification and limitations

The automated suite contains 42 tests. Prepared Apple FY2024–FY2025 statements were also checked through the importer: D&A was recognised and all six supported accounting identities reconciled. This is an import and historical-analysis check, not an independent Excel reconciliation of a complete real-company DCF.

The tool is a research prototype. Review source definitions, forecast assumptions and all material enterprise-to-equity adjustments before interpreting a result. It does not select assumptions or issue investment recommendations.

## Dependencies

JSZip is bundled for XLSX reading; its licence is included in `dist/assets/JSZIP-LICENSE.md`. `@xmldom/xmldom` is a development dependency used by the Node.js importer tests. The browser supplies its own XML parser.

