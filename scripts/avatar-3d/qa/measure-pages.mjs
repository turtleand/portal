import { base, label, launch, writeReport, threeDResource, sourceHashes } from './shared.mjs';

const browser=await launch('chromium',true);
const runs=Number(process.env.PORTAL_QA_RUNS || 10);
const report={at:new Date().toISOString(),label,base,sourceHashes:await sourceHashes(),browser:browser.version(),method:'Fresh Chrome contexts, production serving pipeline, localhost, default motion preference, no network/CPU throttling, 1200ms settle after load. LCP is observed buffered before any input; CLS excludes recent input. OS and GPU caches are not cleared. Same script/profiles are required for baseline and candidate.',profiles:[],errors:[]};
try {
  for(const viewport of [{name:'desktop',width:1440,height:1000,dpr:1},{name:'narrow',width:390,height:844,dpr:2}]) {
    for(const lang of ['en','es']) {
      const rows=[];
      for(let run=1;run<=runs;run++) {
        const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},deviceScaleFactor:viewport.dpr,reducedMotion:'no-preference'});
        const page=await context.newPage();const requests=[],errors=[];
        page.on('request',request=>requests.push(new URL(request.url()).pathname));
        page.on('pageerror',error=>errors.push(error.message));
        await page.addInitScript(()=>{
          window.__qaPerf={lcp:null,cls:0,longTasks:[],supported:PerformanceObserver.supportedEntryTypes};
          for(const type of ['largest-contentful-paint','layout-shift','longtask']) {
            if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
            new PerformanceObserver(list=>{for(const e of list.getEntries()){
              if(type==='largest-contentful-paint')window.__qaPerf.lcp={time:e.startTime,size:e.size,tag:e.element?.tagName,id:e.element?.id};
              if(type==='layout-shift'&&!e.hadRecentInput)window.__qaPerf.cls+=e.value;
              if(type==='longtask')window.__qaPerf.longTasks.push({start:e.startTime,duration:e.duration});
            }}).observe({type,buffered:true});
          }
        });
        const response=await page.goto(`${base}/${lang==='es'?'?lang=es':''}`,{waitUntil:'load'});
        await page.waitForTimeout(1200);
        const result=await page.evaluate(()=>({perf:window.__qaPerf,navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,type:e.initiatorType,transfer:e.transferSize,encoded:e.encodedBodySize,decoded:e.decodedBodySize,duration:e.duration})),dom:document.querySelectorAll('*').length,htmlLength:document.documentElement.outerHTML.length,viewerRegistered:Boolean(customElements.get('model-viewer')),canvases:document.querySelectorAll('canvas').length,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>innerWidth}));
        rows.push({run,status:response?.status(),...result,threeDRequests:requests.filter(threeDResource),errors});
        console.log(`${label} ${viewport.name} ${lang} ${run}/${runs} LCP ${result.perf.lcp?.time ?? 'unavailable'}`);
        await context.close();
      }
      report.profiles.push({viewport,lang,rows});
      await writeReport(`${label}-pages-performance.json`,report);
    }
  }
} catch(error){report.errors.push(error.message);throw error;}
finally{await writeReport(`${label}-pages-performance.json`,report);await browser.close();}
