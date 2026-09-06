import { base,label,launch,writeReport,sourceHashes,S,openGallery,ready,version,installDrawProbe,threeDResource } from './shared.mjs';
const browser=await launch('chromium',true),runs=Number(process.env.PORTAL_QA_RUNS||10);
const report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),browser:browser.version(),method:'Fresh browser contexts with actual production client build and local gzip responses. Selected heaviest/latest model; no OS/GPU cache flush. UI-ready event follows model load, component update and two rAF. WebGL calls establish drawing but not native GPU completion or first screen-presentation timestamp.',profiles:[],errors:[]};
try{
  for(const profile of [{name:'desktop',width:1440,height:1000,dpr:1},{name:'narrow-lab',width:390,height:844,dpr:2,downloadMbit:10,rttMs:80,cpuSlowdown:4}]){
    const rows=[];
    for(let run=1;run<=runs;run++){
      const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,reducedMotion:'reduce'});
      await context.addInitScript(installDrawProbe);
      const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
      const cdp=await context.newCDPSession(page);
      if(profile.name==='narrow-lab'){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1250000,uploadThroughput:625000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
      await page.goto(base,{waitUntil:'networkidle'});await openGallery(page);await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);await version(page,5);
      const before=await page.evaluate(()=>performance.getEntriesByType('resource').map(e=>new URL(e.name).pathname));
      await page.evaluate(({root,mode})=>{
        window.__qaOptInStart=performance.now();window.__qaReadyMs=null;
        document.querySelector(root).addEventListener('avatar-3d:ready',()=>window.__qaReadyMs=performance.now()-window.__qaOptInStart,{once:true});
        document.querySelector(mode).click();
      },{root:S.root,mode:S.mode('3d')});
      await ready(page);
      const result=await page.evaluate(({model,root})=>{
        const el=document.querySelector(model),canvas=el.shadowRoot?.querySelector('canvas');
        const gl=window.__avatarDrawProbe.contexts[0],ext=gl?.getExtension('WEBGL_debug_renderer_info');
        return {readyMs:window.__qaReadyMs,loaded:el.loaded,geometry:el.getDimensions(),rootReady:document.querySelector(root).dataset.modelReady,hostVisibility:getComputedStyle(el).visibility,canvasSize:canvas?{width:canvas.width,height:canvas.height}:null,drawCalls:window.__avatarDrawProbe.draws.reduce((a,b)=>a+b,0),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,encoded:e.encodedBodySize,decoded:e.decodedBodySize,transfer:e.transferSize,duration:e.duration}))};
      },{model:S.model,root:S.root});
      rows.push({run,before3DRequests:before.filter(threeDResource),...result,errors});console.log(`${profile.name} ${run}/${runs}: ${Math.round(result.readyMs)}ms`);
      await context.close();
    }
    report.profiles.push({profile,rows});await writeReport(`${label}-viewer-performance.json`,report);
  }
}catch(error){report.errors.push(error.message);throw error;}
finally{await writeReport(`${label}-viewer-performance.json`,report);await browser.close();}
