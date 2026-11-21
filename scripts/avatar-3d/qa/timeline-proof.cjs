const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');const assert=require('node:assert/strict');const fs=require('node:fs');const crypto=require('node:crypto');const path=require('node:path');
const base=process.env.PORTAL_QA_BASE_URL || 'http://127.0.0.1:4391';
const evidence=process.env.PORTAL_QA_EVIDENCE || 'docs/avatar-3d-implementation/evidence';
const output=path.join(evidence,(process.env.PORTAL_QA_LABEL || 'release')+'-timeline-proof.json');
fs.mkdirSync(evidence,{recursive:true});
const report={at:new Date().toISOString(),sourceHash:crypto.createHash('sha256').update(fs.readFileSync('src/components/avatar/evolution-controller.js')).digest('hex'),checks:[]};
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
for(const lang of ['en','es']){const p=await b.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(`${base}/?lang=${lang}`);await p.locator('[data-open-avatar-gallery]').first().click();await p.locator('[data-evolution-loading][hidden]').waitFor({state:'attached'});await p.waitForTimeout(150);
const state=()=>p.evaluate(()=>{
  const dimensional=document.querySelector('[data-avatar-evolution]').dataset.representation==='3d';
  const selector=dimensional?'data-evolution-3d-select':'data-evolution-select';
  const selected=document.querySelector(`[${selector}][aria-current="step"]`);
  const rail=dimensional?selected.closest('[data-evolution-3d-filmstrip]'):selected.closest('[data-evolution-timeline]').parentElement;
  const a=selected.getBoundingClientRect(),r=rail.getBoundingClientRect();
  return{visible:a.left>=r.left-.5&&a.right<=r.right+.5,left:rail.scrollLeft,modal:document.querySelector('[data-avatar-modal-panel]').scrollTop,width:a.width,current:selected.getAttribute(selector)};
});
for(const mode of ['2d','3d']){if(mode==='3d'){await p.locator('[data-evolution-mode="3d"]').click();await p.locator('[data-model-ready="true"]').waitFor({timeout:45000});}
const selector=mode==='3d'?'data-evolution-3d-select':'data-evolution-select';
const rail=await p.locator(mode==='3d'?'[data-evolution-3d-filmstrip]':'[data-evolution-timeline]').evaluateHandle(el=>el.matches('[data-evolution-timeline]')?el.parentElement:el);
await p.locator('[data-avatar-modal-panel]').evaluate(e=>e.scrollTop=70);const before=await state();
const select=async index=>{await p.locator(`[${selector}="${index}"]`).evaluate(e=>e.click());await p.locator(`[${selector}="${index}"][aria-current="step"]`).waitFor({state:'attached'});};
await select(5);
const last=await state();assert.equal(last.visible,true);assert.equal(last.current,'5');assert.ok(last.left>0);assert.equal(last.modal,before.modal);assert.ok(last.width>=43.99);
await rail.evaluate(e=>e.scrollLeft=0);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));const manual=await state();assert.equal(manual.left,0);
await select(0);
const first=await state();assert.equal(first.visible,true);assert.equal(first.current,'0');assert.equal(first.left,0);assert.equal(first.modal,before.modal);
let restarted;
if(mode==='2d'){
  await rail.evaluate(e=>e.scrollLeft=1000);
  await p.locator('[data-evolution-action="restart"]').evaluate(e=>e.click());
  restarted=await state();assert.equal(restarted.visible,true);assert.equal(restarted.left,0);
}
await rail.dispose();
report.checks.push({lang,mode,pass:true,before,last,first,restarted});}
await p.locator('[data-evolution-3d-filmstrip]').evaluate(e=>e.scrollLeft=1000);await p.locator('[data-avatar-modal-close]').evaluate(e=>e.click());await p.locator('[data-open-avatar-gallery]').first().click();await p.waitForTimeout(100);assert.equal((await state()).visible,true);assert.equal(errors.length,0);report.checks.push({lang,reopenVisible:true,errors,pass:true});await p.close();}
await b.close();fs.writeFileSync(output,JSON.stringify(report,null,2));console.log('Timeline reveal checks passed in EN/ES, 2D/3D,390px, with stable modal scroll and44px targets');})().catch(e=>{report.error=e.stack;fs.writeFileSync(output,JSON.stringify(report,null,2));console.error(e);process.exit(1)});
