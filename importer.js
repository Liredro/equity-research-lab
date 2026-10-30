/* Spreadsheet ingestion and financial-row validation. No user data leaves the browser. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FinancialImporter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const FIELDS = Object.freeze([
    ['revenue','Revenue'],['ebit','EBIT / operating profit'],['da','Depreciation & amortisation'],
    ['capex','Capital expenditure'],['nwc','Change in net working capital'],['cash','Cash & equivalents'],
    ['debt','Total interest-bearing debt'],['shares','Diluted shares outstanding'],['price','Share price']
  ]);
  const SYNONYMS = {
    revenue: [/^revenue$/, /^sales$/, /^net sales$/, /^total revenue$/, /^total sales$/, /^net revenue$/, /^turnover$/],
    ebit: [/^ebit$/, /^operating profit$/, /^operating income$/, /^income from operations$/, /^profit from operations$/],
    da: [/^d (?:and|&) a$/, /^depreciation and amortisation$/, /^depreciation and amortization$/, /^depreciation amortisation$/, /^depreciation amortization$/, /^depreciation expense$/, /^depreciation and amortization expense$/],
    capex: [/^capex$/, /^capital expenditure[s]?$/, /^capital spending$/, /^purchase[s]? of property plant and equipment$/, /^purchases of property plant and equipment$/],
    nwc: [/^change in net working capital$/, /^change in nwc$/, /^delta nwc$/, /^increase in nwc$/, /^investment in nwc$/],
    cash: [/^cash$/, /^cash and equivalents$/, /^cash and cash equivalents$/, /^cash equivalents$/],
    debt: [/^debt$/, /^total debt$/, /^interest bearing debt$/, /^total interest bearing debt$/, /^borrowings$/],
    shares: [/^shares$/, /^diluted shares$/, /^diluted shares outstanding$/, /^shares outstanding$/, /^weighted average diluted shares$/, /^diluted weighted average shares outstanding$/],
    price: [/^share price$/, /^stock price$/, /^market price$/, /^price per share$/, /^current share price$/]
  };
  function normaliseLabel(str) { return String(str ?? '').trim().toLowerCase().replace(/[_–—-]/g,' ').replace(/\s+/g,' ').replace(/&amp;/g, '&').replace(/&/g,'and'); }
  function suggest(label) {
    const value=normaliseLabel(label);
    for(const [key, patterns] of Object.entries(SYNONYMS)) if(patterns.some(regex=>regex.test(value))) return key;
    return '';
  }
  function parseCsv(text) {
    if (typeof text !== 'string' || !text.trim()) throw new Error('The CSV is empty.');
    const rows=[]; let row=[], value='', quoted=false, closed=false;
    const source=text.replace(/^\uFEFF/,'');
    for(let i=0;i<source.length;i++) {
      const c=source[i];
      if(quoted) { if(c==='"' && source[i+1]==='"'){value+='"';i++;} else if(c==='"'){quoted=false;closed=true;} else {value+=c;} continue; }
      if(c==='"' && value.length===0 && !closed){quoted=true;continue;}
      if(c===','){row.push(value);value='';closed=false;continue;}
      if(c==='\n' || c==='\r'){ if(c==='\r'&&source[i+1]==='\n') i++;row.push(value);if(row.some(v=>String(v).trim()))rows.push(row);row=[];value='';closed=false;continue; }
      if(closed && !/\s/.test(c)) throw new Error('Malformed CSV: unexpected characters after a quoted value.');
      value+=c;
    }
    if(quoted)throw new Error('Malformed CSV: a quoted cell is not closed.');
    row.push(value);if(row.some(v=>String(v).trim()))rows.push(row);
    if(rows.length<3)throw new Error('Expected a header and at least two financial rows.');
    if(rows.length>1000)throw new Error('Too many rows (maximum 1,000).');
    return rows;
  }
  function yearColumns(rows){
    const header=rows[0]||[];
    const cols=[];
    header.forEach((item,i)=>{ const raw=String(item??'').trim();if (/^(19|20)\d{2}(?:A|E|F|FY)?$/i.test(raw))cols.push({index:i,year:Number(raw.slice(0,4))}); });
    if(cols.length<2) throw new Error('At least two year columns are required. Use columns such as 2023, 2024 and 2025.');
    const unique=new Set(cols.map(c=>c.year));if(unique.size!==cols.length) throw new Error('Duplicate year columns were found.');
    cols.sort((a,b)=>a.year-b.year);
    if(cols.length>12)throw new Error('Please upload at most 12 historical years.');
    return cols;
  }
  function number(value, cellRef){
    if (typeof value==='number') {if(!Number.isFinite(value))throw new Error(`${cellRef} contains a non-finite number.`);return value;}
    const raw=String(value??'').trim();
    if(!raw || raw==='—' || raw==='–' || raw==='-') return null;
    let s=raw.replace(/[\s,$£€]/g,'').replace(/\u2212/g,'-');
    if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);
    // Don't silently transform a percentage into currency or shares.
    if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))throw new Error(`Non-numeric value in ${cellRef}: "${raw}".`);
    const n=Number(s);if(!Number.isFinite(n)) throw new Error(`${cellRef} is outside the supported numeric range.`);
    return n;
  }
  function inspect(rows) {
    const cols=yearColumns(rows);
    const candidates=rows.slice(1).map((r,i)=>({index:i+1,label:String(r[0]??'').trim(),suggestion:suggest(r[0]), cells:cols.map(c=>r[c.index]??'')})).filter(r=>r.label);
    if(candidates.length<2)throw new Error('Could not find financial statement row labels in the first column.');
    return {cols,candidates};
  }
  function build(rows, mappedRows, options) {
    const {cols,candidates}=inspect(rows);
    const codes={};
    for(const [field,rowIndex] of Object.entries(mappedRows)) {
      if(rowIndex==='' || rowIndex===null || rowIndex===undefined)continue;
      const idx=Number(rowIndex);
      if(!Number.isInteger(idx)||idx<1||idx>=rows.length)throw new Error(`Invalid row selection for ${field}.`);
      if(Object.values(codes).includes(idx))throw new Error('One statement row cannot be assigned to two financial fields.');
      codes[field]=idx;
    }
    const mandatory=['revenue','ebit','da','capex','nwc','cash','debt','shares','price'];
    const missing=mandatory.filter(k=>codes[k]===undefined);
    if(missing.length)throw new Error('Please map the missing financial fields: '+missing.map(k=>FIELDS.find(f=>f[0]===k)[1]).join(', ')+'.');
    const companyName=String(options.name??'').trim();
    if(!companyName||companyName.length>90)throw new Error('Enter a company name (up to 90 characters).');
    const ticker=String(options.ticker??'').trim().toUpperCase();
    if(!/^[A-Z0-9.\-]{1,12}$/.test(ticker))throw new Error('Enter a short ticker or identifier using letters, numbers, dots or hyphens.');
    const currency=String(options.currency??'USD');if(!['USD','EUR','GBP'].includes(currency))throw new Error('Unsupported currency.');
    const units=Number(options.units);
    if(![1,1000,1e6].includes(units)) throw new Error('Choose source values in units, thousands or millions.');
    const scale=units/1e6; // represent all amounts and shares as millions
    const years=cols.map(x=>x.year), last=years.length-1;
    const get=(field,idx)=>number(rows[codes[field]][cols[idx].index], `${rows[codes[field]][0]} / ${years[idx]}`);
    const requiredYearFields=['revenue','ebit','da','capex','nwc'];
    // Historical missing values in older years are permitted, but latest two revenues and latest-year operating inputs must exist.
    for(const field of requiredYearFields)if(get(field,last)===null)throw new Error(`${FIELDS.find(f=>f[0]===field)[1]} is missing for ${years[last]}.`);
    if(get('revenue',last-1)===null) throw new Error('Previous-year revenue is needed to derive growth.');
    const result=cols.map((col,i)=>{
      const revenue=get('revenue',i);const ebit=get('ebit',i);const da=get('da',i);const capex=get('capex',i);const nwc=get('nwc',i);
      if(revenue!==null && revenue<=0)throw new Error(`Revenue in ${col.year} must be positive.`);
      if(da!==null && da<0)throw new Error(`D&A in ${col.year} must be non-negative.`);
      if(capex!==null && capex<0)throw new Error(`CapEx in ${col.year} must be a positive outflow magnitude; please reverse any negative statement sign in your file.`);
      return {year:col.year,revenue:revenue===null?null:revenue*scale,ebitMargin:revenue && ebit!==null?100*ebit/revenue:null,
        fcf:(ebit!==null&&da!==null&&capex!==null&&nwc!==null)?(ebit-Math.max(0,ebit)*.25+da-capex-nwc)*scale:null,
        ebit:ebit===null?null:ebit*scale, da:da===null?null:da*scale,capex:capex===null?null:capex*scale,nwc:nwc===null?null:nwc*scale};
    });
    // Only the last available year's capital structure and market price are used.
    const latest={};for(const key of ['cash','debt','shares','price'])latest[key]=get(key,last);
    for(const key of ['cash','debt'])if(latest[key]===null||latest[key]<0)throw new Error(`${FIELDS.find(f=>f[0]===key)[1]} must be non-negative in ${years[last]}.`);
    if(latest.shares===null||latest.shares<=0)throw new Error(`Diluted shares outstanding must be positive in ${years[last]}.`);
    if(latest.price===null||latest.price<=0)throw new Error(`Share price must be positive in ${years[last]}.`);
    const current=result[last], prior=result[last-1];
    const historicGrowth=(current.revenue/prior.revenue-1)*100;
    if(!Number.isFinite(historicGrowth)) throw new Error('Revenue growth cannot be calculated.');
    const proposedGrowth=Math.max(-5,Math.min(25,historicGrowth));
    const proposedMargin=Math.max(-30,Math.min(60,current.ebitMargin));
    const clip=(n,low,high)=>Math.max(low,Math.min(high,n));
    const depreciation=clip(current.da/current.revenue*100,0,20);
    const capex=clip(current.capex/current.revenue*100,0,25);
    let wc=2; let wcReason='The ΔNWC rate defaults to 2% of the revenue change; review this assumption.';
    if(Math.abs(current.revenue-prior.revenue)>1e-10){
      const ratio=current.nwc/(current.revenue-prior.revenue)*100;
      if(Number.isFinite(ratio)&&ratio>=0&&ratio<=30){wc=ratio;wcReason='The ΔNWC rate uses the latest year’s working-capital change divided by its change in sales.';}
    }
    const warnings=[
      'WACC (9%), perpetual growth (2.5%) and tax (25%) are illustrative starting assumptions, not extracted facts.',
      'Historical FCF (if displayed) is a rough illustration using a 25% assumed tax rate; it is not reported cash flow.',
      wcReason,
      'All amounts, except per-share prices, are converted to millions using the selected units.'
    ];
    if(proposedGrowth!==historicGrowth)warnings.push(`Historical growth (${historicGrowth.toFixed(1)}%) falls outside the editable initial range; proposed growth was limited to ${proposedGrowth.toFixed(1)}%.`);
    if(proposedMargin!==current.ebitMargin)warnings.push('The latest EBIT margin is outside the initial editable range and has been capped. Review this before relying on the valuation.');
    if(depreciation!==current.da/current.revenue*100||capex!==current.capex/current.revenue*100)warnings.push('A historical D&A or CapEx ratio exceeds the initial control range and has been capped.');
    if(years.some((y,i)=>i>0&&y-years[i-1]!==1))warnings.push('Gaps exist between historical years; historical growth uses the most recent two available columns.');
    const defaultInputs={growth:proposedGrowth,fade:1,margin:proposedMargin,marginStep:0.25,tax:25,
      depreciation,capex,workingCapital:wc,wacc:9,terminalGrowth:2.5,
      cash:latest.cash*scale,debt:latest.debt*scale,shares:latest.shares*scale,marketPrice:latest.price};
    return {name:companyName,ticker,sector:'User-provided financial data',description:`Imported ${years[0]}–${years[last]} financial statement data, provided by the user.`,currency,historical:result,defaults:defaultInputs,warnings,
      provenance:Object.fromEntries(Object.entries(codes).map(([k,idx])=>[k,{row:idx+1,label:String(rows[idx][0]??''),latestColumn:cols[last].index+1,year:years[last]}])),
      summary:{year:years[last],years,latestRevenue:current.revenue,latestEbit:current.ebit,historicGrowth}};
  }
  // Decode XLSX files using the bundled JSZip utility, with no network access.
  async function parseXlsx(buffer) {
    if(typeof JSZip==='undefined')throw new Error('XLSX reader unavailable. Please use CSV.');
    const zip=await JSZip.loadAsync(buffer);
    const getXML=async path=>{const entry=zip.file(path);if(!entry)throw new Error(`Invalid XLSX: missing ${path}.`);return new DOMParser().parseFromString(await entry.async('string'),'application/xml');};
    const children=(node,name)=>node ? Array.from(node.getElementsByTagName('*')).filter(n=>n.localName===name) : [];
    const attr=(node,name)=>node?.getAttribute(name);
    const wb=await getXML('xl/workbook.xml'); const rel=await getXML('xl/_rels/workbook.xml.rels');
    const links={};children(rel,'Relationship').forEach(n=>links[attr(n,'Id')]=attr(n,'Target'));
    let strings=[];
    if(zip.file('xl/sharedStrings.xml')){
      const shared=await getXML('xl/sharedStrings.xml');
      strings=children(shared,'si').map(n=>children(n,'t').map(t=>t.textContent).join(''));
    }
    const result=[];
    for(const sheet of children(wb,'sheet')){
      const rid=sheet.getAttribute('r:id') || Array.from(sheet.attributes).find(a=>a.localName==='id')?.value;
      const target=links[rid];if(!target)continue;
      let path=target.startsWith('/')?target.slice(1):('xl/'+target).replace(/^xl\/xl\//,'xl/');
      const parts=[];for(const p of path.split('/')){if(p==='..')parts.pop();else if(p!=='.')parts.push(p);}path=parts.join('/');
      const xml=await getXML(path);
      const rows=[]; const rowNumbers=[];
      for(const row of children(xml,'row')){
        const arr=[];
        for(const cell of children(row,'c')){
          const reference=cell.getAttribute('r')||'';const letters=/^[A-Z]+/.exec(reference)?.[0];if(!letters)continue;
          let col=0;for(const c of letters)col=col*26+(c.charCodeAt(0)-64);col--;
          if(col>100)throw new Error('XLSX sheets wider than 100 columns are not supported.');
          const type=cell.getAttribute('t'),valueNode=children(cell,'v')[0],inline=children(cell,'is')[0];
          let value='';
          if(type==='s'){value=strings[Number(valueNode?.textContent)]??'';}
          else if(type==='inlineStr'){value=children(inline,'t').map(n=>n.textContent).join('');}
          else if(type==='b'){value=valueNode?.textContent==='1'?'TRUE':'FALSE';}
          else value=valueNode?.textContent??'';
          arr[col]=value;
        }
        if(arr.some(v=>String(v??'').trim())){rows.push(arr);rowNumbers.push(Number(row.getAttribute('r'))||rows.length);}
      }
      result.push({name:sheet.getAttribute('name')||'Worksheet',rows,rowNumbers});
    }
    if(!result.length)throw new Error('No readable worksheet was found.');
    return result;
  }
  return {FIELDS,parseCsv,parseXlsx,inspect,suggest,build};
});
