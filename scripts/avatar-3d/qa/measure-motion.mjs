import {base,label,launch,sourceHashes,writeReport,S,openGallery,ready,version} from './shared.mjs';

// Query one synchronous renderer submission batch. Microtask completion follows
// its synchronous draw calls. This is measured GPU work when the extension is
// available; it is not display presentation latency or the entire browser frame.
function probe(){
  const records=[],contexts=new Map();window.__motion={enabled:false,records,cadence:[],last:null};
  function sample(gl){
    let info=contexts.get(gl);
    if(!info){info={extension:gl.getExtension('EXT_disjoint_timer_query_webgl2'),pending:[],active:null};contexts.set(gl,info);}
    if(!window.__motion.enabled||info.active)return;
    const start=performance.now(),query=info.extension?gl.createQuery():null;
    if(query)gl.beginQuery(info.extension.TIME_ELAPSED_EXT,query);
    info.active={query,start};
    queueMicrotask(()=>{if(query)gl.endQuery(info.extension.TIME_ELAPSED_EXT);const row={cpuSubmissionMs:performance.now()-start,gpuMs:null,disjoint:false};records.push(row);if(query)info.pending.push({query,row});info.active=null;});
  }
  for(const Type of [window.WebGLRenderingContext,window.WebGL2RenderingContext].filter(Boolean))for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
    const original=Type.prototype[method];if(typeof original!=='function')continue;
    Type.prototype[method]=function(...args){sample(this);return Reflect.apply(original,this,args);};
  }
  function frame(t){if(window.__motion.enabled){if(window.__motion.last!==null)window.__motion.cadence.push(t-window.__motion.last);window.__motion.last=t;}else window.__motion.last=null;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  setInterval(()=>{for(const [gl,info]of contexts)for(let i=info.pending.length-1;i>=0;i--){const {query,row}=info.pending[i];if(gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){row.disjoint=Boolean(gl.getParameter(info.extension.GPU_DISJOINT_EXT));if(!row.disjoint)row.gpuMs=gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6;gl.deleteQuery(query);info.pending.splice(i,1);}}},100);
  window.__motionInfo=()=>[...contexts].map(([gl,info])=>{const debug=gl.getExtension('WEBGL_debug_renderer_info');return{gpuTimersAvailable:Boolean(info.extension),gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):null};});
}
const browser=await launch('chromium',true),report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),browser:browser.version(),method:'Latest model, 2s warmup then 20s automatic turntable. GPU elapsed queries bracket synchronous draw batches if available. CPU submission durations and animation-frame cadence are separate measurements. Not display presentation time or physical-device evidence.',profiles:[],errors:[]};
try{
  for(const profile of [{name:'desktop',width:1440,height:1000,dpr:1},{name:'narrow-lab',width:390,height:844,dpr:2,cpuSlowdown:4}]){
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,reducedMotion:'no-preference'});await context.addInitScript(probe);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));const cdp=await context.newCDPSession(page);if(profile.cpuSlowdown)await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpuSlowdown});
    await page.goto(base,{waitUntil:'networkidle'});await openGallery(page);await page.locator(S.play).click();await version(page,5);
    await cdp.send('Performance.enable');await cdp.send('HeapProfiler.collectGarbage');const before=await cdp.send('Performance.getMetrics');
    await page.locator(S.mode('3d')).click();await ready(page);await page.locator(S.model).scrollIntoViewIfNeeded();await page.locator(S.action('rotation')).click();await page.waitForTimeout(2000);
    await page.evaluate(()=>window.__motion.enabled=true);await page.waitForTimeout(20000);await page.evaluate(()=>window.__motion.enabled=false);await page.locator(S.action('rotation')).click();await page.waitForTimeout(400);
    const result=await page.evaluate(()=>({contexts:window.__motionInfo(),records:window.__motion.records,cadence:window.__motion.cadence}));await cdp.send('HeapProfiler.collectGarbage');const after=await cdp.send('Performance.getMetrics');
    const heap=r=>r.metrics.find(item=>item.name==='JSHeapUsedSize')?.value;
    report.profiles.push({profile,...result,heapBefore:heap(before),heapLoaded:heap(after),heapIncrement:heap(after)-heap(before),errors});await context.close();await writeReport(`${label}-motion-performance.json`,report);console.log(`${profile.name}: ${result.records.length} render batches; GPU timer availability ${result.contexts.some(c=>c.gpuTimersAvailable)}`);
  }
}catch(error){report.errors.push(error.message);throw error;}
finally{await writeReport(`${label}-motion-performance.json`,report);await browser.close();}
