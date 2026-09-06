const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const source='src/components/avatar/three-d-controller.js';
const base=process.env.PORTAL_QA_BASE_URL || 'http://127.0.0.1:4391';
const output='docs/avatar-3d-implementation/evidence/'+(process.env.PORTAL_QA_LABEL || 'release')+'-timeout-restart-proof.json';
fs.mkdirSync('docs/avatar-3d-implementation/evidence',{recursive:true});
const report={at:new Date().toISOString(),sourceHash:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),checks:[]};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
  for(const name of ['Hung HDR','Hung runtime then late success','Hung runtime then late rejection']){
    const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);
    await page.locator('[data-open-avatar-gallery]').first().click();
    await page.locator('[data-evolution-loading][hidden]').waitFor({state:'attached'});
    let release,hit;const gate=new Promise(r=>release=r),intercepted=new Promise(r=>hit=r);let count=0;
    const pattern=name==='Hung HDR'?'**/*.hdr*':/model-viewer.*\.js(?:\?|$)/;
    await page.route(pattern,async route=>{
      if(++count===1){hit();await gate;if(name.endsWith('rejection'))await route.abort('failed').catch(()=>{});else await route.continue().catch(()=>{});}
      else await route.continue();
    });
    const started=Date.now();
    await page.locator('[data-evolution-mode="3d"]').click();await intercepted;
    await page.locator('[data-evolution-3d-action="retry"]:not([hidden])').waitFor({timeout:42000});
    const fallbackMs=Date.now()-started;
    assert.ok(fallbackMs>=29000&&fallbackMs<42000);
    assert.equal(await page.locator('[data-avatar-evolution]').getAttribute('data-model-ready'),'false');
    await page.locator('[data-evolution-3d-action="retry"]').click();
    await page.locator('[data-model-ready="true"]').waitFor({timeout:25000});
    assert.ok(count>=2);
    release();await page.waitForTimeout(2500);
    assert.equal(await page.locator('[data-avatar-evolution]').getAttribute('data-model-ready'),'true');
    assert.equal(await page.locator('model-viewer').count(),1);
    assert.equal(errors.length,0);
    report.checks.push({name,pass:true,fallbackMs,requests:count,errors});save();console.log(name,'PASS',fallbackMs);
    await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);await page.locator('[data-open-avatar-gallery]').first().click();await page.locator('[data-evolution-loading][hidden]').waitFor({state:'attached'});
  await page.locator('[data-evolution-action="play"]').click();await page.locator('[data-evolution-mode="3d"]').click();await page.locator('[data-model-ready="true"]').waitFor();
  await page.locator('[data-evolution-action="restart"]').click();assert.equal(await page.locator('[data-avatar-evolution]').getAttribute('data-model-ready'),'true');
  const seen=new Set();const started=Date.now();
  while(Date.now()-started<55000){const v=await page.locator('[data-evolution-meta]').textContent();seen.add(v.split(' • ')[0]);if(v.startsWith('v0.1.1')&&await page.locator('[data-avatar-evolution]').getAttribute('data-model-ready')==='true')break;await page.waitForTimeout(200);}
  assert.equal(seen.size,6);assert.equal(await page.locator('model-viewer').getAttribute('auto-rotate'),null);assert.equal(errors.length,0);
  report.checks.push({name:'Restart ready Genesis completes all six stages and rests',pass:true,elapsedMs:Date.now()-started,seen:[...seen],errors});save();console.log('Ready-stage restart PASS');
  await browser.close();
})().catch(error=>{report.error=error.stack;save();console.error(error);process.exit(1)});
