import {base,label,launch,writeReport,sourceHashes,check,S,manifest,openGallery,ready,version} from './shared.mjs';
const report={at:new Date().toISOString(),base,label,sourceHashes:await sourceHashes(),scope:'Targeted 390px horizontal timeline reveal and vertical-scroll preservation. Programmatic activation isolates controller scrolling from browser focus/action auto-scroll.',checks:[],errors:[]};
const browser=await launch('chromium',true);
try{
  for(const lang of ['en','es']){
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`${base}/${lang==='es'?'?lang=es':''}`,{waitUntil:'networkidle'});await openGallery(page);await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);
    for(const mode of ['2d','3d']){
      if(mode==='3d'){await page.locator(S.mode(mode)).click();await ready(page);}
      for(const index of [5,0,5,0]){
        const initial=await page.locator(S.panel).evaluate(el=>{el.scrollTop=Math.min(100,el.scrollHeight-el.clientHeight);return el.scrollTop;});
        await page.locator(S.version(index)).evaluate(el=>el.click());if(mode==='3d')await ready(page);
        const result=await page.evaluate(({panel,index})=>{const button=document.querySelector(`[data-evolution-select="${index}"]`),rail=document.querySelector('[data-evolution-timeline]').parentElement,b=button.getBoundingClientRect(),r=rail.getBoundingClientRect();return{scrollTop:document.querySelector(panel).scrollTop,selectedVisible:b.left>=r.left-.5&&b.right<=r.right+.5,buttonLeft:b.left,buttonRight:b.right,railLeft:r.left,railRight:r.right,scrollLeft:rail.scrollLeft};},{panel:S.panel,index});
        check(report,`${lang} ${mode} ${manifest[index].version} reveals marker without vertical scroll`,result.selectedVisible&&Math.abs(result.scrollTop-initial)<1,{initial,...result});
      }
    }
    await page.locator(S.mode('2d')).click();await version(page,5);await page.locator(S.close).click();await openGallery(page);
    const reset=await page.evaluate(()=>{const b=document.querySelector('[data-evolution-select="0"]').getBoundingClientRect(),r=document.querySelector('[data-evolution-timeline]').parentElement.getBoundingClientRect();return b.left>=r.left-.5&&b.right<=r.right+.5;});
    check(report,`${lang} reopen reveals first marker`,reset);check(report,`${lang} timeline changes have no page errors`,errors.length===0,{errors});await context.close();
  }
}catch(error){report.errors.push(error.message);check(report,'Timeline regression completed',false,{error:error.message});}
finally{await writeReport(`${label}-timeline-regression.json`,report);await browser.close();}
if(report.checks.some(item=>!item.pass))process.exitCode=1;
