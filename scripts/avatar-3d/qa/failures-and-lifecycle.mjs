import { base,label,launch,writeReport,sourceHashes,check,S,manifest,openGallery,ready,version,state,installDrawProbe } from './shared.mjs';
const browser=await launch('chromium',true);
const report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),browser:browser.version(),scope:'Chrome production client QA build; injected network/graphics faults and observed draw submissions. No GPU duration or memory claim.',checks:[],cases:[],errors:[]};
async function runCase(name,body,init){
  if(process.env.PORTAL_QA_CASES&&!new RegExp(process.env.PORTAL_QA_CASES,'i').test(name))return;
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  if(init)await context.addInitScript(init);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{await body(page,context);check(report,`${name} no unhandled page errors`,errors.length===0,{errors});}
  catch(error){check(report,`${name} completed`,false,{error:error.message});}
  finally{report.cases.push({name,errors});await context.close();await writeReport(`${label}-failures-lifecycle.json`,report);}
}
const enter=async page=>{await page.goto(base,{waitUntil:'networkidle'});await openGallery(page);await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);};
const fallbackVisible=async page=>{const found=await state(page);return found.ready!=='true'&&found.canonical.some(layer=>layer.svg);};
const waitFailure=async(page,timeout=50000)=>page.waitForFunction(selector=>{const el=document.querySelector(selector);return el&&!el.hidden;},S.action('retry'),{timeout});

await runCase('Delayed model and latest selection',async page=>{
  await enter(page);let release;const gate=new Promise(resolve=>release=resolve);let intercepted=false;
  await page.route('**/*.glb*',async route=>{if(!intercepted){intercepted=true;await gate;}await route.continue().catch(()=>{});});
  await page.locator(S.mode('3d')).click();await page.waitForTimeout(400);
  check(report,'Canonical SVG remains visible while selected GLB is delayed',await fallbackVisible(page));
  await version(page,5);release();await ready(page);
  const found=await state(page);
  check(report,'Old model completion cannot replace latest selected version',found.version.includes(manifest[5].version)&&found.viewers===1&&found.ready==='true',{state:found});
  await page.unroute('**/*.glb*');
});

await runCase('Missing model and explicit retry',async page=>{
  await enter(page);await page.route('**/*.glb*',route=>route.abort('failed'));
  await page.locator(S.mode('3d')).click();await waitFailure(page);
  check(report,'Model failure preserves selected canonical SVG and retry',await fallbackVisible(page)&&(await state(page)).version.includes(manifest[0].version),{state:await state(page)});
  await page.unroute('**/*.glb*');await page.locator(S.action('retry')).click();await ready(page);
  check(report,'Retry recovers the failed selected model',(await state(page)).ready==='true');
});

await runCase('Malformed GLB',async page=>{
  await enter(page);await page.route('**/*.glb*',route=>route.fulfill({status:200,contentType:'model/gltf-binary',body:'invalid binary model'}));
  await page.locator(S.mode('3d')).click();await waitFailure(page);
  check(report,'Decoder failure returns a usable selected canonical SVG',await fallbackVisible(page),{state:await state(page)});
  await page.locator(S.mode('2d')).click();await page.locator(S.next).click();
  check(report,'Gallery navigation survives decode failure',(await state(page)).version.includes(manifest[1].version));
});

for(const fault of ['blocked','malformed'])await runCase(`${fault} HDR environment and retry`,async page=>{
  await enter(page);
  await page.route('**/*.hdr*',route=>fault==='blocked'?route.abort('failed'):route.fulfill({status:200,contentType:'application/octet-stream',body:'invalid HDR environment'}));
  await page.locator(S.mode('3d')).click();await waitFailure(page);
  check(report,`${fault} HDR returns selected canonical fallback`,await fallbackVisible(page),{state:await state(page)});
  await page.unroute('**/*.hdr*');await page.locator(S.action('retry')).click();await ready(page);
  check(report,`${fault} HDR explicit retry recovers lighting and model`,(await state(page)).ready==='true');
});

for(const resource of ['HDR','runtime'])await runCase(`Hung ${resource} timeout and retry`,async page=>{
  await enter(page);let release;const gate=new Promise(resolve=>release=resolve);let intercepted=false,attempts=0;
  const pattern=resource==='HDR'?'**/*.hdr*':/model-viewer.*\.js(?:\?|$)/;
  await page.route(pattern,async route=>{attempts++;if(!intercepted){intercepted=true;await gate;}await route.continue().catch(()=>{});});
  const start=Date.now();await page.locator(S.mode('3d')).click();await waitFailure(page,50000);const elapsedMs=Date.now()-start;
  check(report,`Hung ${resource} has bounded canonical fallback`,await fallbackVisible(page)&&elapsedMs<49000,{elapsedMs,state:await state(page)});
  // Keep the first route unresolved until after successful retry. This proves a
  // fresh request rather than accidentally rescuing the timed-out promise.
  await page.locator(S.action('retry')).click();await ready(page);
  check(report,`Hung ${resource} retry makes a fresh request and recovers`,attempts>=2&&(await state(page)).ready==='true',{attempts});
  release();await page.unroute(pattern);
});

await runCase('Runtime import failure',async page=>{
  await enter(page);await page.route(/model-viewer.*\.js(?:\?|$)/,route=>route.abort('failed'));
  await page.locator(S.mode('3d')).click();await waitFailure(page);
  check(report,'Renderer import failure retains canonical and controls',await fallbackVisible(page));
  await page.unroute(/model-viewer.*\.js(?:\?|$)/);await page.locator(S.action('retry')).click();await ready(page);
  check(report,'Explicit retry recovers renderer import',(await state(page)).ready==='true');
});

await runCase('Rapid mode changes and close while loading',async page=>{
  await enter(page);let release;const gate=new Promise(resolve=>release=resolve);
  await page.route('**/*.glb*',async route=>{await gate;await route.continue().catch(()=>{});});
  await page.locator(S.mode('3d')).click();await page.waitForTimeout(200);
  await page.locator(S.mode('2d')).click();await page.locator(S.mode('3d')).click();await page.locator(S.close).click();release();
  await page.waitForTimeout(700);
  const found=await state(page);check(report,'Late loads cannot reopen or recreate a closed viewer',!found.open&&found.viewers===0&&found.ready!=='true',{state:found});
  await page.unroute('**/*.glb*');await openGallery(page);
  check(report,'Reopen starts canonical first stage in 2D',(await state(page)).mode==='2d'&&(await state(page)).version.includes(manifest[0].version));
  await page.locator(S.mode('3d')).click();await ready(page);
  check(report,'3D remains usable after interrupted open/close',(await state(page)).ready==='true');
});

await runCase('Initial canonical loading race',async page=>{
  await page.goto(base,{waitUntil:'networkidle'});let release;const gate=new Promise(resolve=>release=resolve);
  await page.route(/turtleand-[^/]+\.svg(?:\?|$)/,async route=>{await gate;await route.continue().catch(()=>{});});
  await openGallery(page);await page.waitForTimeout(200);
  const modeEnabled=await page.locator(S.mode('3d')).isEnabled();
  let selectedWhileLoading=false;
  if(modeEnabled){await page.locator(S.mode('3d')).click();if(await page.locator(S.version(5)).isEnabled()){await page.locator(S.version(5)).click();selectedWhileLoading=true;}}
  release();await page.unroute(/turtleand-[^/]+\.svg(?:\?|$)/);await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);
  if(modeEnabled)await ready(page);
  const found=await state(page);
  check(report,'Late canonical activation cannot silently reset a user-selected 3D version',!selectedWhileLoading||found.version.includes(manifest[5].version),{selectionGated:!selectedWhileLoading,state:found});
});

await runCase('Unsupported graphics',async page=>{
  await enter(page);await page.locator(S.mode('3d')).click();await waitFailure(page);
  check(report,'Unavailable graphics leaves selected canonical and usable navigation',await fallbackVisible(page),{state:await state(page)});
  await page.locator(S.mode('2d')).click();await page.locator(S.next).click();
  check(report,'2D navigation works without WebGL',(await state(page)).version.includes(manifest[1].version));
},()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:original.call(this,type,...args);};});

await runCase('Real WebGL context loss',async page=>{
  await enter(page);await page.locator(S.mode('3d')).click();await ready(page);
  const support=await page.evaluate(()=>{const gl=window.__avatarDrawProbe.contexts[0];window.__qaLostContext=gl?.getExtension('WEBGL_lose_context');return Boolean(window.__qaLostContext);});
  if(!support){report.cases.push({name:'Real WebGL context loss extension',available:false});return;}
  await page.evaluate(()=>window.__qaLostContext.loseContext());
  await waitFailure(page,10000);
  check(report,'Context loss returns canonical fallback',await fallbackVisible(page),{state:await state(page)});
  await page.evaluate(()=>window.__qaLostContext.restoreContext());await page.waitForTimeout(500);
  await page.locator(S.action('retry')).click();await ready(page);
  check(report,'Context restoration and explicit retry recover 3D',(await state(page)).ready==='true');
},installDrawProbe);

// This measures the application's resource lifetime,
// with real draws instrumented, not an assertion based only on DOM removal.
await runCase('Draw work and twenty lifecycle cycles',async(page,context)=>{
  await page.emulateMedia({reducedMotion:'no-preference'});await enter(page);
  await page.locator(S.play).click(); // Stop initial 2D autoplay before opt-in.
  await page.locator(S.mode('3d')).click();await ready(page);await page.locator(S.model).scrollIntoViewIfNeeded();
  const drawTotal=()=>page.evaluate(()=>window.__avatarDrawProbe.draws.reduce((a,b)=>a+b,0));
  await page.waitForTimeout(800);let first=await drawTotal();await page.waitForTimeout(600);let last=await drawTotal();
  check(report,'Paused settled viewer submits no WebGL draws',last===first,{draws:last-first});
  await page.locator(S.action('rotation')).click();await page.waitForTimeout(700);first=await drawTotal();await page.waitForTimeout(600);last=await drawTotal();
  check(report,'Active turntable submits WebGL draws',last>first,{draws:last-first});
  await page.locator(S.play).click();await page.waitForTimeout(900);first=await drawTotal();await page.waitForTimeout(600);last=await drawTotal();
  check(report,'Main pause stops turntable WebGL draw work',last===first,{draws:last-first});
  await page.locator(S.action('rotation')).click();await page.waitForTimeout(500);
  const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();await page.waitForTimeout(600);
  const actualHidden=await page.evaluate(()=>document.hidden);
  if(actualHidden){first=await drawTotal();await page.waitForTimeout(600);last=await drawTotal();check(report,'Actually hidden tab stops WebGL draws',first===last,{draws:last-first});}
  else {report.cases.push({name:'Actual headless tab visibility',available:false,reason:'Browser keeps both headless pages visible; synthetic visibility branch check recorded separately.'});await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(800);first=await drawTotal();await page.waitForTimeout(600);last=await drawTotal();check(report,'Synthetic hidden-document branch stops WebGL draws',first===last,{draws:last-first,synthetic:true});await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});}
  await other.close();await page.bringToFront();await page.locator(S.close).click();await page.waitForTimeout(800);first=await drawTotal();await page.waitForTimeout(600);last=await drawTotal();
  check(report,'Closed gallery submits no WebGL draws',last===first,{draws:last-first});
  // Probe retains WebGL context references so it cannot establish GPU disposal.
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const cycles=[];
  for(let cycle=1;cycle<=20;cycle++){
    await openGallery(page);await page.locator(S.play).click();await page.locator(S.mode('3d')).click();await ready(page);
    for(let index=0;index<manifest.length;index++){await version(page,index);await ready(page);}
    await page.locator(S.close).click();await page.waitForTimeout(500);await cdp.send('HeapProfiler.collectGarbage');
    const metrics=await cdp.send('Performance.getMetrics'),dom=await cdp.send('Memory.getDOMCounters');
    cycles.push({cycle,heap:metrics.metrics.find(item=>item.name==='JSHeapUsedSize')?.value,...dom,viewers:await page.locator('model-viewer').count()});console.log(`lifecycle ${cycle}/20`);
  }
  report.lifecycle={method:'20 full-lineage cycles; close, 500ms settle, forced CDP GC, JS heap/DOM counters. Draw probe retains renderer contexts; no GPU disposal claim.',cycles};
  const tail=cycles.slice(-5),nodes=new Set(tail.map(item=>item.nodes)),listeners=new Set(tail.map(item=>item.jsEventListeners));
  check(report,'Twenty cycles retain no active viewers and stabilize DOM/listeners',cycles.every(item=>item.viewers===0)&&nodes.size===1&&listeners.size===1,{tail});
},installDrawProbe);

await writeReport(`${label}-failures-lifecycle.json`,report);await browser.close();
if(report.checks.some(item=>!item.pass))process.exitCode=1;
