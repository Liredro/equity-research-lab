/* Transparent financial analysis. Missing data remain null; percentages use percentage points. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.Research=api;})(globalThis,()=>{
'use strict';
const fields=[['revenue','Revenue'],['cogs','Cost of revenue'],['grossProfit','Gross profit'],['opex','Operating expenses (excl. cost of revenue)'],['ebit','EBIT / operating profit'],['da','Depreciation & amortisation'],['capex','Capital expenditure'],['nwc','Change in operating NWC'],['cfo','Operating cash flow'],['netIncome','Net income'],['cash','Cash & equivalents'],['debt','Interest-bearing debt'],['equity','Total equity'],['assets','Total assets'],['liabilities','Total liabilities'],['shares','Diluted shares'],['price','Share price']];
const aliases={revenue:['revenue','revenues','net revenue','total revenue','sales','net sales','turnover'],cogs:['cost of revenue','cost of revenues','cost of sales','cost of goods sold'],grossProfit:['gross profit','gross income'],opex:['operating expenses','total operating expenses'],ebit:['ebit','operating profit','operating income','income from operations','profit from operations'],da:['da','d a','depreciation and amortisation','depreciation and amortization','depreciation amortization','depreciation amortisation','d and a','depreciation and amortization expense','depreciation and amortisation expense','depreciation and amortization expenses','depreciation and amortisation expenses'],capex:['capex','capital expenditure','capital expenditures','purchases of property plant and equipment','purchase of property plant and equipment'],nwc:['change in net working capital','change in operating working capital','change in nwc','increase in nwc'],cfo:['operating cash flow','cash flow from operations','net cash provided by operating activities','net cash from operating activities','cash generated from operations'],netIncome:['net income','net profit','profit for the year'],cash:['cash','cash and cash equivalents','cash and equivalents'],debt:['total debt','interest bearing debt','total interest bearing debt','borrowings'],equity:['equity','total equity','total shareholders equity','shareholders equity'],assets:['total assets'],liabilities:['total liabilities'],shares:['diluted shares','diluted shares outstanding','weighted average diluted shares','diluted weighted average shares outstanding'],price:['share price','market price','stock price']};
const normal=s=>String(s??'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
function daReview(label){
 const n=normal(label);
 if(aliases.da.includes(n))return null;
 if(!/\b(depreciation|amorti[sz]ation)\b/.test(n))return null;
 if(/accumulated|net of/.test(n))return 'This is a balance-sheet stock or net balance, not an annual D&A expense.';
 if(/other|impairment|adjusted|adjustments/.test(n))return 'This line includes other adjustments. The full amount is not automatically treated as D&A.';
 return 'This may be a component or a differently defined D&A figure. Verify annual depreciation plus amortisation in the supporting notes.';
}
function numeric(v){if(v==null||String(v).trim()===''||/^[—–-]$/.test(String(v).trim()))return null;let s=String(v).trim().replace(/[,$£€\s]/g,'').replace(/−/g,'-');if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);if(!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)||!Number.isFinite(+s))throw Error('Invalid number: '+String(v).slice(0,50));return +s;}
function year(v){let m=/^(?:FY\s*)?((?:19|20)\d{2})(?:\s*A)?$/i.exec(String(v??'').trim());return m?+m[1]:null;}
function inspect(sheets){let candidates=[],warnings=[];
 sheets.forEach((sheet,si)=>{let headers=[],labelCol=0;
 sheet.rows.forEach((row,ri)=>{const ys=row.map((v,i)=>({year:year(v),col:i})).filter(x=>x.year);
 const prefix=row.slice(0,ys[0]?.col??0).map(normal).filter(Boolean).join(' ');
 const headerLabel=!prefix||/^(metric|financial statement line|year|years|fiscal year|fiscal years|period|periods|year ended.*|years ended.*|as at.*|june 30.*)$/.test(prefix);
 if(ys.length>=2&&headerLabel){if(new Set(ys.map(x=>x.year)).size!==ys.length)throw Error('Duplicate fiscal years in '+sheet.name);headers=ys;labelCol=Math.max(0,ys[0].col-1);return;}
 if(!headers.length)return;
 let label=String(row[labelCol]??'').trim();if(!label)return;
 const values={};headers.forEach(h=>values[h.year]=row[h.col]??null);
 if(!Object.values(values).some(v=>v!==null&&String(v).trim()!==''))return;
 let match=fields.find(([k,l])=>normal(l)===normal(label))?.[0]||Object.entries(aliases).find(([k,aa])=>aa.includes(normal(label)))?.[0]||'';
 candidates.push({id:si+':'+ri,sheet:sheet.name,row:sheet.rowNumbers?.[ri]||ri+1,label,values,columns:Object.fromEntries(headers.map(h=>[h.year,h.col+1])),match});
 });if(!headers.length)warnings.push(sheet.name+': no annual year header found; worksheet skipped.');});
 const mapping={};for(const [key] of fields){const choices=candidates.filter(c=>c.match===key);if(choices.length===1)mapping[key]=choices[0].id;else if(choices.length>1)warnings.push(fields.find(f=>f[0]===key)[1]+': multiple matches; select the correct statement row.');}
 if(candidates.length>4000)throw Error('Too many candidate rows (maximum 4,000).');
 if(!candidates.length)throw Error('No annual tables detected. Use metric rows and at least two fiscal-year columns (e.g. FY2024, FY2025).');
 const daSuggestions=candidates.filter(c=>daReview(c.label)).map(c=>({...c,reason:daReview(c.label)}));
 return {candidates,mapping,warnings,daSuggestions};}
function build(info,mapping,options){if(!String(options.name||'').trim())throw Error('Enter a company name.');const data={},provenance={};const used=new Set();
 for(const [key] of fields){if(key==='da'&&options.daOverride?.enabled)continue;if(!mapping[key])continue;const row=info.candidates.find(x=>x.id===mapping[key]);if(!row)throw Error('Invalid mapping for '+key);if(key==='da'&&daReview(row.label))throw Error('D&A needs review: '+daReview(row.label)+' Leave it unmapped or enter verified D&A values in the review panel.');if(used.has(row.id))throw Error('A source row cannot map to two fields.');used.add(row.id);
 const unit=+(options.units?.[key]??1e6);if(![1,1e3,1e6].includes(unit))throw Error('Invalid units.');const sign=options.reverse?.[key]?-1:1;
 data[key]=Object.fromEntries(Object.entries(row.values).map(([y,v])=>{const n=numeric(v);return [y,n===null?null:n*sign*(key==='price'?1:unit/1e6)];}));provenance[key]={...row,unit,sign};}
 if(!data.revenue)throw Error('Map revenue to begin analysis.');const years=Object.keys(data.revenue).map(Number).filter(y=>data.revenue[y]!=null).sort((a,b)=>a-b);if(years.length<2)throw Error('At least two years of revenue are required.');
 if(years.length>12)throw Error('Maximum 12 historical years.');
 if(options.daOverride?.enabled){
 const o=options.daOverride,sourceNote=String(o.sourceNote||'').trim();
 if(!sourceNote)throw Error('Add a source reference explaining the verified D&A figures.');
 if(!o.confirmed)throw Error('Confirm that the entered D&A excludes other adjustments.');
 const values={};for(const y of years){const n=numeric(o.values?.[y]);if(n!=null&&n<0)throw Error('Verified D&A must be non-negative.');values[y]=n;}
 if(Object.values(values).every(v=>v===null))throw Error('Enter at least one verified D&A value. Blank years stay unavailable.');
 data.da=values;provenance.da={sheet:'Analyst verification',row:0,label:'Verified depreciation and amortisation',columns:Object.fromEntries(years.map((y,i)=>[y,i+1])),values,unit:1e6,sign:1,method:'analyst-verified',sourceNote:sourceNote.slice(0,1000)};
 }

 const history=years.map(y=>{const h={year:y};fields.forEach(([k])=>h[k]=data[k]?.[y]??null);if(h.revenue<=0)throw Error('Revenue must be positive in '+y);for(const k of ['da','capex','cogs','opex','cash','debt','shares','price'])if(h[k]!=null&&h[k]<0)throw Error(k+' is negative in '+y+'. Review the source sign and use Reverse sign if appropriate.');return h;});
 return {name:options.name.trim().slice(0,90),ticker:String(options.ticker||'CUSTOM').slice(0,12),currency:['USD','GBP','EUR'].includes(options.currency)?options.currency:'USD',history,provenance,source:options.source||'Uploaded financials',sample:false};}
const div=(a,b)=>a!=null&&b!=null&&b!==0?a/b:null;
function metrics(h,prior,tax=25){const ebitda=h.ebit!=null&&h.da!=null?h.ebit+h.da:null;const fcf=h.cfo!=null&&h.capex!=null?h.cfo-h.capex:null;const ic=x=>x&&['debt','equity','cash'].every(k=>x[k]!=null)?x.debt+x.equity-x.cash:null;const c=ic(h),p=ic(prior),avg=c!=null&&p!=null?(c+p)/2:null;
 return {revenue:h.revenue,ebit:h.ebit,ebitda,fcf,grossMargin:div(h.grossProfit,h.revenue),operatingMargin:div(h.ebit,h.revenue),fcfConversion:div(fcf,h.netIncome>0?h.netIncome:null),roic:div(h.ebit!=null?h.ebit*(1-tax/100):null,avg>0?avg:null),leverage:div(h.debt!=null&&h.cash!=null?h.debt-h.cash:null,ebitda>0?ebitda:null),growth:prior&&h.year-prior.year===1?div(h.revenue-prior.revenue,prior.revenue):null};}
function checks(company){const out=[];for(const h of company.history){const test=(name,keys,a,b)=>{if(keys.some(k=>h[k]==null)){out.push({year:h.year,name,status:'unavailable',detail:'Missing '+keys.filter(k=>h[k]==null).join(', ')});return;}const gap=a()-b(),tol=Math.max(.01,Math.max(Math.abs(a()),Math.abs(b()))*.005);out.push({year:h.year,name,status:Math.abs(gap)<=tol?'pass':'review',detail:'Difference '+gap.toFixed(2)+'m; tolerance '+tol.toFixed(2)+'m'});};
 test('Revenue − cost of revenue = gross profit',['revenue','cogs','grossProfit'],()=>h.revenue-h.cogs,()=>h.grossProfit);
 test('Gross profit − operating expenses = EBIT',['grossProfit','opex','ebit'],()=>h.grossProfit-h.opex,()=>h.ebit);
 test('Assets = liabilities + equity',['assets','liabilities','equity'],()=>h.assets,()=>h.liabilities+h.equity);}
 return out;}
function defaults(c){const h=c.history.at(-1),p=c.history.at(-2),g=100*((h.revenue/p.revenue)**(1/(h.year-p.year))-1);return {wacc:9,terminalGrowth:2.5,tax:25,cash:h.cash??null,debt:h.debt??null,shares:h.shares??null,marketPrice:h.price??null,minority:0,preferred:0,other:0,bridgeConfirmation:null,years:Array.from({length:5},(_,i)=>({growth:Math.max(-50,Math.min(40,g-i*1.5)),margin:h.ebit!=null?100*h.ebit/h.revenue:20,da:h.da!=null?100*h.da/h.revenue:4,capex:h.capex!=null?100*h.capex/h.revenue:6,nwc:10}))};}
const bridgeKeys=['cash','debt','minority','preferred','other','shares'];
function bridgeConfirmed(a){return !!a.bridgeConfirmation&&bridgeKeys.every(k=>Number.isFinite(a[k])&&a.bridgeConfirmation[k]===a[k]);}
function confirmBridge(a){if(bridgeKeys.some(k=>!Number.isFinite(a[k]))||a.shares<=0||['cash','debt','minority','preferred'].some(k=>a[k]<0))throw Error('Complete and review all equity-bridge inputs, including diluted shares. Enter zero explicitly where appropriate.');return Object.fromEntries(bridgeKeys.map(k=>[k,a[k]]));}
function dcf(c,a){const nums=['wacc','terminalGrowth','tax','cash','debt','shares','minority','preferred','other'];if(nums.some(k=>typeof a[k]!=='number'||!Number.isFinite(a[k])))throw Error('Complete all valuation inputs with finite numbers.');if(a.wacc<=0||a.wacc<=a.terminalGrowth)throw Error('WACC must be positive and exceed terminal growth.');if(a.terminalGrowth<=-100||a.shares<=0||a.tax<0||a.tax>100||['cash','debt','minority','preferred'].some(k=>a[k]<0))throw Error('Review shares, tax and capital structure inputs.');if(a.marketPrice!=null&&(!Number.isFinite(a.marketPrice)||a.marketPrice<=0))throw Error('Reference share price must be positive or left blank.');if(!bridgeConfirmed(a))throw Error('Confirm the equity-bridge inputs before calculating intrinsic value.');if(!Array.isArray(a.years)||a.years.length!==5)throw Error('Five forecast years are required.');
 let prev=c.history.at(-1).revenue;const start=c.history.at(-1).year;const years=a.years.map((y,i)=>{if(['growth','margin','da','capex','nwc'].some(k=>!Number.isFinite(y[k]))||y.growth<=-100||y.da<0||y.capex<0||y.nwc<0)throw Error('Review forecast assumptions for year '+(i+1));const revenue=prev*(1+y.growth/100),ebit=revenue*y.margin/100,tax=Math.max(0,ebit)*a.tax/100,nopat=ebit-tax,da=revenue*y.da/100,capex=revenue*y.capex/100,nwc=(revenue-prev)*y.nwc/100,fcf=nopat+da-capex-nwc,pv=fcf/(1+a.wacc/100)**(i+1);prev=revenue;return {year:start+i+1,revenue,ebit,tax,nopat,da,capex,nwc,fcf,pv};});
 const terminal=years[4].fcf*(1+a.terminalGrowth/100)/((a.wacc-a.terminalGrowth)/100),pvTerminal=terminal/(1+a.wacc/100)**5,pvFlows=years.reduce((s,y)=>s+y.pv,0),ev=pvFlows+pvTerminal,equity=ev+a.cash-a.debt-a.minority-a.preferred+a.other,price=equity/a.shares;
 if(!Number.isFinite(price))throw Error('Valuation exceeds numeric range.');return {years,terminal,pvTerminal,pvFlows,ev,equity,price,upside:a.marketPrice==null?null:100*(price/a.marketPrice-1),terminalWeight:ev>0?100*pvTerminal/ev:null};}
function wacc(x){if(!x||['rf','beta','erp','kd','tax','equity','debt'].some(k=>!Number.isFinite(x[k]))||x.equity<0||x.debt<0||x.equity+x.debt<=0||x.tax<0||x.tax>100)throw Error('Enter valid capital weights and tax.');const ke=x.rf+x.beta*x.erp;return {ke,value:(ke*x.equity+x.kd*(1-x.tax/100)*x.debt)/(x.equity+x.debt)};}
return {fields,inspect,build,metrics,checks,defaults,dcf,wacc,numeric,daReview,bridgeKeys,bridgeConfirmed,confirmBridge};});
