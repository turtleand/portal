import path from 'node:path';
import {launch, base, label, evidence, sourceHashes} from './shared.mjs';
import fs from 'node:fs/promises';
const runs=Number(process.env.PORTAL_QA_RUNS||3);
const output=path.join(evidence,'game-art');
await fs.mkdir(output,{recursive:true});
const browser=await launch('chromium',true);
const report={label,browser:browser.version(),renderer:process.env.PORTAL_QA_SOFTWARE_GL==='1'?'SwiftShader software WebGL':'Browser default WebGL',sourceHashes:await sourceHashes(),method:'Same production client build config and gzip localhost server. Fresh contexts; measured click to gallery ready, not physical-device or GPU presentation timing.',runs:[]};
try{
for(const profile of ['desktop','mobile'])for(let run=0;run<runs;run++){
  const narrow=profile==='mobile';
  const context=await browser.newContext({viewport:narrow?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:narrow?2:1,reducedMotion:'reduce'});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(narrow){const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1250000,uploadThroughput:625000});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('[data-open-avatar-gallery]').first().click();
  await page.waitForFunction(()=>document.querySelector('[data-avatar-modal]').getAttribute('aria-hidden')==='false');
  await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);
  await page.locator('[data-evolution-select="5"]').click();
  const before=await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/model-viewer|\.glb|\.hdr/.test(e.name)).map(e=>e.name));
  await page.evaluate(()=>{window.__start=performance.now();document.querySelector('[data-avatar-evolution]').addEventListener('avatar-3d:ready',()=>window.__elapsed=performance.now()-window.__start,{once:true});document.querySelector('[data-evolution-mode="3d"]').click();});
  await page.waitForFunction(()=>document.querySelector('[data-avatar-evolution]').dataset.modelReady==='true',{},{timeout:60000});
  const result=await page.evaluate(()=>{const el=document.querySelector('model-viewer');return {readyMs:window.__elapsed,clips:el.availableAnimations,resources:performance.getEntriesByType('resource').filter(e=>/model-viewer|\.glb|\.hdr/.test(e.name)).map(e=>({name:e.name,start:e.startTime,duration:e.duration,encoded:e.encodedBodySize,decoded:e.decodedBodySize})),overflow:document.documentElement.scrollWidth>innerWidth};});
  report.runs.push({profile,run,before,errors,...result});console.log(label,profile,run,Math.round(result.readyMs)+'ms');
  if(run===0){await page.locator('[data-evolution-canvas]').screenshot({path:`${output}/${label}-${profile}.png`});if(!narrow){for(let index=0;index<6;index++){await page.locator(`[data-evolution-select="${index}"]`).click();await page.waitForFunction(()=>document.querySelector('[data-avatar-evolution]').dataset.modelReady==='true');await page.locator('[data-evolution-canvas]').screenshot({path:`${output}/${label}-v${index}.png`});}}}
  await context.close();
}
}finally{await fs.writeFile(`${output}/${label}-performance.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
