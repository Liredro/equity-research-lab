const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../dist/assets/importer.js');
const M = require('../dist/assets/model.js');
const text = fs.readFileSync(path.join(__dirname,'../dist/samples/aurora-financials.csv'),'utf8');
const rows = I.parseCsv(text);
const mapped=Object.fromEntries(I.inspect(rows).candidates.filter(r=>r.suggestion).map(r=>[r.suggestion,r.index]));
const options={name:'Aurora Technology (Sample)',ticker:'AURA',currency:'USD',units:1000000};
test('CSV handles quoted data and BOM',()=>{
  const r=I.parseCsv('\ufeffMetric,2024,2025\r\n"Sales, net","1,000","1,300"\r\nEBIT,100,150');
  assert.deepEqual(r[1],['Sales, net','1,000','1,300']);
});
test('identifies nine relevant financial lines and four years',()=>{
  const info=I.inspect(rows);
  assert.equal(info.cols.length,4);
  assert.equal(Object.keys(mapped).length,9);
});
test('full import feeds the 5-year valuation with 2025 baseline',()=>{
  const data=I.build(rows,mapped,options);
  assert.equal(data.summary.year,2025);
  assert.equal(data.historical.at(-1).revenue,1435);
  assert.equal(data.defaults.marketPrice,26.8);
  assert.equal(data.defaults.shares,120);
  assert.ok(data.warnings.some(w=>w.includes('illustrative')));
  const result=M.calculate(data.defaults,data.historical);
  assert.equal(result.years[0].year,2026);
  assert.ok(Number.isFinite(result.price));
});
test('validates missing mapping and rejects duplicate financial row',()=>{
  assert.throws(()=>I.build(rows,{...mapped,price:undefined},options),/missing financial/i);
  assert.throws(()=>I.build(rows,{...mapped,price:mapped.debt},options),/assigned to two/i);
});
test('rejects negative capex instead of silently changing source convention',()=>{
  const next=rows.map(r=>r.slice()); next[4][4]='-112';
  assert.throws(()=>I.build(next,mapped,options),/positive outflow/i);
});
test('rejects missing latest-year financial cells',()=>{
  const next=rows.map(r=>r.slice());next[1][4]='';
  assert.throws(()=>I.build(next,mapped,options),/missing for 2025/i);
});
test('rejects malformed year columns and incomplete quotes',()=>{
  assert.throws(()=>I.inspect([['Metric','2025'],['Revenue','100']]),/two year/i);
  assert.throws(()=>I.parseCsv('Metric,2024,2025\n"Revenue,10,20'),/not closed/);
});
test('rejects malformed numeric values instead of inventing them',()=>{
  const next=rows.map(r=>r.slice());next[2][4]='probably 298';
  assert.throws(()=>I.build(next,mapped,options),/Non-numeric/);
});
test('Excel XLSX: reads cached numeric and shared string cells without a server',async()=>{
  const JSZip=require('../dist/assets/jszip.min.js');
  const {DOMParser}=require('@xmldom/xmldom');
  global.JSZip=JSZip;global.DOMParser=DOMParser;
  const z=new JSZip();
  z.file('xl/workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Accounts" sheetId="1" r:id="rId1"/></sheets></workbook>');
  z.file('xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"/></Relationships>');
  z.file('xl/sharedStrings.xml','<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>Metric</t></si><si><t>Revenue</t></si><si><t>EBIT</t></si></sst>');
  z.file('xl/worksheets/sheet1.xml','<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1"><v>2024</v></c><c r="C1"><v>2025</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>125</v></c><c r="C2"><v>140</v></c></row><row r="3"><c r="A3" t="s"><v>2</v></c><c r="B3"><v>20</v></c><c r="C3"><v>25</v></c></row></sheetData></worksheet>');
  const content=await z.generateAsync({type:'nodebuffer'});
  const sheets=await I.parseXlsx(content);
  assert.equal(sheets[0].name,'Accounts');
  assert.deepEqual(sheets[0].rows[1],['Revenue','125','140']);
  assert.deepEqual(I.inspect(sheets[0].rows).cols.map(x=>x.year),[2024,2025]);
});
