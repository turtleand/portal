import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { base,label,engines,launch,writeReport,sourceHashes,check,S,manifest,threeDResource,openGallery,ready,version,state,evidence } from './shared.mjs';
const baseline=process.env.PORTAL_QA_BASELINE==='1';
const report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),scope:'Production-optimized static client QA build. Not Netlify SSR emulation or physical-device validation.',normalChronologyIncluded:process.env.PORTAL_QA_SKIP_CHRONOLOGY!=='1',allVersionContactSheets:process.env.PORTAL_QA_CONTACT_SHEETS==='1',checks:[],browsers:[],screens:[],errors:[]};
await fs.mkdir(evidence,{recursive:true});
async function contactSheet(buffers,name,width,height){
  const cellWidth=width===390?390:600,cellHeight=Math.round(height*cellWidth/width),caption=26,items=[];
  for(let i=0;i<buffers.length;i++){
    const left=(i%3)*cellWidth,top=Math.floor(i/3)*(cellHeight+caption);
    items.push({input:await sharp(buffers[i]).resize(cellWidth,cellHeight).png().toBuffer(),left,top:top+caption});
    items.push({input:Buffer.from(`<svg width="${cellWidth}" height="${caption}"><rect width="100%" height="100%" fill="#102922"/><text x="12" y="18" font-size="14" fill="#fff" font-family="sans-serif">${manifest[i].version} · ${name.includes('-2d-')?'2D canonical':'3D Sculpted Warmth'}</text></svg>`),left,top});
  }
  await sharp({create:{width:cellWidth*3,height:(cellHeight+caption)*2,channels:4,background:'#102922'}}).composite(items).png().toFile(path.join(evidence,name));
  report.screens.push(name);
}
for(const engine of engines){
  let browser;
  try {browser=await launch(engine,engine==='chromium');report.browsers.push({engine,version:browser.version(),available:true});}
  catch(error){report.browsers.push({engine,available:false,error:error.message.split('\n')[0]});continue;}
  for(const size of [{name:'desktop',width:1440,height:1000},{name:'narrow',width:390,height:844}])for(const lang of ['en','es']){
    const prefix=`${engine}/${size.name}/${lang}`;
    if(process.env.PORTAL_QA_PROFILE&&!new RegExp(process.env.PORTAL_QA_PROFILE).test(prefix))continue;
    const context=await browser.newContext({viewport:{width:size.width,height:size.height},hasTouch:size.name==='narrow',reducedMotion:'reduce'});
    const page=await context.newPage(),requests=[],errors=[];
    page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
    try {
      await page.goto(`${base}/${lang==='es'?'?lang=es':''}`,{waitUntil:'networkidle'});
      check(report,`${prefix} unopened gallery requests no 3D resources`,!requests.some(threeDResource));
      check(report,`${prefix} language matches route`,await page.locator('html').getAttribute('lang')===lang);
      await openGallery(page);
      await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);
      check(report,`${prefix} opened 2D requests no 3D resources`,!requests.some(threeDResource));
      const canonicalCaptures=[],modelCaptures=[];
      for(let index=0;index<manifest.length;index++){
        if(index)await page.locator(S.next).click();
        const found=await state(page);
        check(report,`${prefix} 2D ${manifest[index].version} canonical and text`,found.version.includes(manifest[index].version)&&found.title===manifest[index][lang==='es'?'titleEs':'title']&&found.canonical.some(item=>item.index===String(index)&&item.svg),{state:found});
        if(process.env.PORTAL_QA_CONTACT_SHEETS==='1'){await page.locator(S.stage).scrollIntoViewIfNeeded();canonicalCaptures.push(await page.screenshot());}
      }
      if(canonicalCaptures.length)await contactSheet(canonicalCaptures,`${label}-${engine}-${size.name}-${lang}-2d-lineage.png`,size.width,size.height);
      check(report,`${prefix} reduced 2D has no walking image requests`,!requests.some(url=>/\/(?:contact-a|contact-b|passing)[^/]*\.svg/.test(url)));
      await page.locator(S.previous).click();
      check(report,`${prefix} previous navigates`,(await state(page)).version.includes(manifest[4].version));
      await page.locator(S.restart).click();
      check(report,`${prefix} restart returns to first`,(await state(page)).version.includes(manifest[0].version));
      const panel=page.locator(S.panel);
      await page.locator(S.close).focus();
      let contained=true;
      const tabKey=engine==='webkit'?'Alt+Tab':'Tab';
      for(let i=0;i<24;i++){await page.keyboard.press(tabKey);contained&&=await page.evaluate(selector=>document.querySelector(selector).contains(document.activeElement),S.panel);}
      check(report,`${prefix} keyboard focus stays in modal`,contained,{key:tabKey,note:engine==='webkit'?'WebKit on this macOS host requires Option+Tab for all-controls navigation. Plain Tab skips buttons identically in baseline and candidate; separate comparison evidence retained.':undefined});
      await page.keyboard.press('Escape');
      check(report,`${prefix} Escape restores trigger focus`,await page.evaluate(selector=>document.activeElement.matches(selector),S.trigger));
      await openGallery(page);
      check(report,`${prefix} reopen resets first version`,(await state(page)).version.includes(manifest[0].version));
      if(!baseline){
        await page.locator(S.mode('3d')).focus();await page.keyboard.press('Enter');await ready(page);
        for(let index=0;index<manifest.length;index++){
          if(index){await version(page,index);await ready(page);}
          const found=await state(page);
          check(report,`${prefix} 3D ${manifest[index].version} geometry, text, one viewer`,found.ready==='true'&&found.loaded&&found.viewers===1&&Object.values(found.dimensions||{}).length===3&&Object.values(found.dimensions||{}).every(value=>value>0)&&found.version.includes(manifest[index].version)&&found.title===manifest[index][lang==='es'?'titleEs':'title'],{state:found});
          if(process.env.PORTAL_QA_CONTACT_SHEETS==='1'){await page.locator(S.model).scrollIntoViewIfNeeded();modelCaptures.push(await page.screenshot());}
        }
        if(modelCaptures.length)await contactSheet(modelCaptures,`${label}-${engine}-${size.name}-${lang}-3d-lineage.png`,size.width,size.height);
        check(report,`${prefix} reduced 3D automatic motion disabled`,!(await state(page)).rotating&&await page.locator(S.action('rotation')).isDisabled());
        const before=await page.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
        if(size.name==='narrow')await page.locator(S.action('right')).tap();else await page.locator(S.action('right')).click();
        const after=await page.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
        await page.locator(S.action('reset')).click();
        const reset=await page.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
        check(report,`${prefix} accessible camera controls and reset`,Math.abs(after-before)>.1&&Math.abs(reset-before)<.02,{before,after,reset});
        await page.locator(S.mode('2d')).click();
        const back=await state(page);
        check(report,`${prefix} return to 2D keeps selection and canonical`,back.viewers===0&&back.version.includes(manifest[5].version)&&back.canonical.some(item=>item.index==='5'&&item.svg));
        await page.locator(S.mode('3d')).click();await ready(page);
        check(report,`${prefix} return to 3D remains usable`,(await state(page)).ready==='true');
      }
      const finalState=await state(page);
      check(report,`${prefix} document and modal have no horizontal overflow`,!finalState.overflow&&!finalState.panelOverflow,{state:finalState});
      const name=`${label}-${engine}-${size.name}-${lang}-gallery.png`;
      await page.screenshot({path:path.join(evidence,name)});report.screens.push(name);
      await page.locator(S.close).click();
      check(report,`${prefix} close clears viewer and restores focus`,await page.evaluate(({trigger,model})=>document.activeElement.matches(trigger)&&document.querySelectorAll(model).length===0,{trigger:S.trigger,model:S.model}));
      check(report,`${prefix} no unhandled page errors`,errors.length===0,{errors});
    }catch(error){check(report,`${prefix} scenario completed`,false,{error:error.message,state:await state(page).catch(()=>null),modelBounds:await page.locator(S.model).boundingBox().catch(()=>null),errors});}
    finally {await context.close();await writeReport(`${label}-browser-matrix.json`,report);}
  }
  if(process.env.PORTAL_QA_SKIP_CHRONOLOGY==='1'){await browser.close();continue;}
  // Normal-motion chronology is exercised once per engine without clock acceleration.
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'});
  const page=await context.newPage();
  try {
    await page.goto(base,{waitUntil:'networkidle'});
    await page.evaluate(()=>{
      window.__walkEvidence={versions:[],poses:[],overlaps:0};
      window.__walkTimer=setInterval(()=>{
        const visible=element=>!element.hidden&&getComputedStyle(element).display!=='none'&&Number(getComputedStyle(element).opacity)>0;
        const meta=document.querySelector('[data-evolution-meta]')?.textContent?.match(/v\d+\.\d+\.\d+/)?.[0];
        if(meta&&!window.__walkEvidence.versions.includes(meta))window.__walkEvidence.versions.push(meta);
        const walking=[...document.querySelectorAll('img[data-walk-pose]')].filter(image=>visible(image)&&visible(image.closest('[data-evolution-layer]')));
        for(const image of walking){const item=`${meta}:${image.dataset.walkPose}`;if(!window.__walkEvidence.poses.includes(item))window.__walkEvidence.poses.push(item);}
        const effects=document.querySelector('[data-evolution-effects]');
        if(walking.length&&effects&&!effects.hidden)window.__walkEvidence.overlaps++;
      },50);
    });
    await openGallery(page);
    await page.waitForTimeout(500);
    await page.locator(S.play).click();
    const pausedText=await page.locator(S.meta).textContent();await page.waitForTimeout(600);
    check(report,`${engine} 2D pause holds selected version`,await page.locator(S.meta).textContent()===pausedText);
    await page.locator(S.play).click();
    await page.waitForFunction(({meta,expected})=>document.querySelector(meta)?.textContent.includes(expected),{meta:S.meta,expected:manifest.at(-1).version},{timeout:45000});
    await page.waitForTimeout(2400);
    const walk=await page.evaluate(()=>{clearInterval(window.__walkTimer);return window.__walkEvidence;});
    const final=await state(page);
    check(report,`${engine} 2D complete chronological walking`,manifest.every(stage=>walk.versions.includes(stage.version)&&walk.poses.some(pose=>pose.startsWith(`${stage.version}:`))),{walk});
    check(report,`${engine} 2D walks and transitions never overlap`,walk.overlaps===0,{walk});
    check(report,`${engine} 2D final stage rests and stops`,final.canonical.some(item=>item.index==='5'&&item.svg)&&await page.locator('[data-evolution-play-label]').textContent()==='Play',{state:final});
  }catch(error){check(report,`${engine} normal chronology scenario completed`,false,{error:error.message});}
  finally {await context.close();await browser.close();await writeReport(`${label}-browser-matrix.json`,report);}
}
if(report.checks.some(item=>!item.pass)||report.browsers.some(item=>!item.available))process.exitCode=1;
