import { engines, launch, writeReport } from './shared.mjs';
const report={at:new Date().toISOString(), scope:'Installed browser launch inventory only; no app assertions.', browsers:[]};
for(const engine of engines){
  try { const browser=await launch(engine,engine==='chromium'); report.browsers.push({engine,available:true,version:browser.version(),channel:engine==='chromium'?'chrome':'bundled'});await browser.close(); }
  catch(error){report.browsers.push({engine,available:false,reason:error.message.split('\n')[0]});}
}
await writeReport('browser-inventory.json',report);
console.log(JSON.stringify(report));
