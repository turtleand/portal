import {launch,writeReport,sourceHashes,threeDResource,label} from './shared.mjs';
const browser=await launch('chromium',true),runs=Number(process.env.PORTAL_QA_RUNS||10);
const report={at:new Date().toISOString(),label,sourceHashes:await sourceHashes(),browser:browser.version(),method:'Follow-up to the borderline desktop ES primary batch. Ten pairs, alternating which build is first, in one Chrome process with fresh contexts. Same 1440×1000 DPR1, default motion, no throttling and 1200ms post-load settle as the primary page measurement. Original measurements are retained.',rows:[]};
try{
  for(let pair=1;pair<=runs;pair++)for(const name of pair%2?['baseline','final']:['final','baseline']){
    const base=name==='baseline'?'http://127.0.0.1:4390':'http://127.0.0.1:4391',context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1,reducedMotion:'no-preference'}),page=await context.newPage(),requests=[],errors=[];
    page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.__paired={lcp:null,cls:0,longTasks:[]};for(const type of ['largest-contentful-paint','layout-shift','longtask'])new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')window.__paired.lcp=e.startTime;if(type==='layout-shift'&&!e.hadRecentInput)window.__paired.cls+=e.value;if(type==='longtask')window.__paired.longTasks.push(e.duration);}}).observe({type,buffered:true});});
    await page.goto(`${base}/?lang=es`,{waitUntil:'load'});await page.waitForTimeout(1200);const metrics=await page.evaluate(()=>window.__paired);
    report.rows.push({pair,name,base,...metrics,threeDRequests:requests.filter(threeDResource),errors});console.log(`pair ${pair} ${name}: ${metrics.lcp}ms`);await context.close();
  }
}finally{await writeReport(`${label}-paired-pages-performance.json`,report);await browser.close();}
