import {base,label,launch,writeReport,sourceHashes,check,S,manifest,openGallery,ready,state,threeDResource} from './shared.mjs';
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
  await page.goto(base,{waitUntil:'networkidle'});await openGallery(page);await page.locator(S.play).click();await page.locator(S.mode('3d')).click();await ready(page);
  await page.locator(S.model).scrollIntoViewIfNeeded();await page.locator(S.play).click();
  await page.waitForTimeout(700);
  await page.locator(S.play).click();const paused=await state(page);await page.waitForTimeout(1000);
  check(report,'Main 3D pause holds version and stops rotation',!(await state(page)).rotating&&(await state(page)).version===paused.version);
  await page.locator(S.play).click();await page.locator(S.model).scrollIntoViewIfNeeded();
  const before=await page.locator(S.model).evaluate(el=>el.getCameraOrbit().theta),bounds=await page.locator(S.model).boundingBox();
  const x=bounds.x+bounds.width*.5,y=bounds.y+bounds.height*.45;
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+100,y,{steps:10});await page.mouse.up();await page.waitForTimeout(400);
  const after=await page.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
  check(report,'Pointer orbit moves camera and stops automatic motion',Math.abs(after-before)>.05&&!(await state(page)).rotating,{before,after});
  await page.locator(S.restart).click();
  const seen=[];const deadline=Date.now()+55000;
  while(Date.now()<deadline){const s=await state(page),v=s.version.match(/v\d+\.\d+\.\d+/)?.[0];if(v&&!seen.includes(v))seen.push(v);if(v===manifest.at(-1).version&&s.ready==='true'&&!s.rotating)break;await page.waitForTimeout(300);}
  const final=await state(page);
  check(report,'3D restart visits all versions chronologically and stops at final rest',seen.join(',')===manifest.map(v=>v.version).join(',')&&final.ready==='true'&&!final.rotating,{seen,state:final});
  await context.close();

  const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await touch.newPage();
  await p.goto(base,{waitUntil:'networkidle'});await openGallery(p);await p.locator(S.mode('3d')).tap();await ready(p);await p.locator(S.model).scrollIntoViewIfNeeded();
  const b=await p.locator(S.model).boundingBox(),cdp=await touch.newCDPSession(p);
  const t0=await p.locator(S.model).evaluate(el=>el.getCameraOrbit().theta),tx=b.x+b.width*.45,ty=b.y+b.height*.40;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
  for(let step=1;step<=8;step++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+step*10,y:ty}]});await p.waitForTimeout(20);}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await p.waitForTimeout(300);
  const t1=await p.locator(S.model).evaluate(el=>el.getCameraOrbit().theta);
  check(report,'Emulated touch drag rotates the 3D avatar',Math.abs(t1-t0)>.05,{before:t0,after:t1});
  check(report,'Viewer permits vertical touch scrolling',await p.locator(S.model).getAttribute('touch-action')==='pan-y');
  await touch.close();
}catch(error){report.errors.push(error.message);check(report,'Navigation and motion suite completed',false,{error:error.message});}
finally{await writeReport(`${label}-navigation-motion.json`,report);await browser.close();}
if(report.checks.some(item=>!item.pass))process.exitCode=1;
