import {base,label,launch,writeReport,sourceHashes,check,S,manifest,openGallery,ready,version,state,threeDResource} from './shared.mjs';
const browser=await launch('chromium',true),report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),browser:browser.version(),scope:'Production static client navigation and real-time motion/input tests; Chrome touch input is emulated, not physical mobile.',checks:[],errors:[]};
try {
  for(const lang of ['en','es'])for(const route of ['/','/about/','/feeds/','/feeds.json','/feeds.opml']){
    const context=await browser.newContext();const page=await context.newPage(),requests=[],errors=[];
    page.on('request',request=>requests.push(request.url()));page.on('pageerror',error=>errors.push(error.message));
    const response=await page.goto(`${base}${route}${lang==='es'?'?lang=es':''}`,{waitUntil:'networkidle'});
    check(report,`${lang} ${route} responds without 3D requests`,response.status()===200&&!requests.some(threeDResource),{status:response.status(),threeDRequests:requests.filter(threeDResource)});
    if(route.endsWith('/')){
      check(report,`${lang} ${route} language and public navigation`,await page.locator('html').getAttribute('lang')===lang&&await page.locator('header a[href]').count()>0&&errors.length===0,{errors});
      const links=await page.locator('header a[href]').evaluateAll(anchors=>anchors.map(a=>({href:a.getAttribute('href'),text:a.textContent.trim()})));
      report.checks.at(-1).links=links;
    }
    await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'no-preference'}),page=await context.newPage();
  await page.goto(base,{waitUntil:'networkidle'});await openGallery(page);
  await page.locator(S.root).evaluate(root=>{
    window.__readyLineage=[];
    root.addEventListener('avatar-3d:ready',event=>window.__readyLineage.push(event.detail.id));
  });
  await page.locator(S.mode('3d')).click();
  await ready(page);
  const finalId=manifest.at(-1).id;
  await page.waitForFunction(id=>window.__readyLineage.includes(id),finalId,{timeout:45000});
  const seen=await page.evaluate(()=>window.__readyLineage.slice());
  await page.waitForTimeout(3000);
  const final=await state(page);
  check(report,'3D visits all versions chronologically, then holds the final model at rest',
    seen.join(',')===manifest.map(stage=>stage.id).join(',')&&final.title===manifest.at(-1).title
    &&final.ready==='true'&&await page.locator(S.model).evaluate(el=>el.paused),{seen,state:final});
  await version(page,manifest.length-2);
  await page.waitForFunction(({id,length})=>window.__readyLineage.length===length&&window.__readyLineage.at(-1)===id,
    {id:finalId,length:manifest.length+2},{timeout:6500});
  check(report,'Choosing an earlier thumbnail from the final stage resumes the sequence', (await state(page)).title===manifest.at(-1).title);
  await context.close();

  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'no-preference'}),p=await touch.newPage();
  await p.goto(base,{waitUntil:'networkidle'});await openGallery(p);await p.locator(S.mode('3d')).tap();await ready(p);await p.locator(S.model).scrollIntoViewIfNeeded();
  const b=await p.locator(S.model).boundingBox(),cdp=await touch.newCDPSession(p);
  const t0=await p.locator(S.model).evaluate(el=>el.getCameraOrbit().theta),tx=b.x+b.width*.45,ty=b.y+b.height*.40;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
  for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+step*10,y:ty}]});await p.waitForTimeout(20);}
  await p.waitForTimeout(2850);
  const t1=await p.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
  check(report,'Emulated touch drag rotates the avatar and holds its chapter while held',
    Math.abs(t1-t0)>.05&&(await state(p)).title===manifest[0].title,{before:t0,after:t1});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await p.waitForFunction(({selector,title})=>document.querySelector(selector)?.textContent===title,
    {selector:S.threeDTitle,title:manifest[1].title},{timeout:6500});
  check(report,'Releasing the emulated touch drag lets the sequence continue', (await state(p)).title===manifest[1].title);
  check(report,'Viewer permits vertical touch scrolling',await p.locator(S.model).getAttribute('touch-action')==='pan-y');
  await touch.close();
}catch(error){report.errors.push(error.message);check(report,'Navigation and motion suite completed',false,{error:error.message});}
finally{await writeReport(`${label}-navigation-motion.json`,report);await browser.close();}
if(report.checks.some(item=>!item.pass))process.exitCode=1;
