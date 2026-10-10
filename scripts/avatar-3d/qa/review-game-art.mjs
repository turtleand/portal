import path from 'node:path';
import {launch,base,evidence,sourceHashes} from './shared.mjs';
import sharp from 'sharp';
import fs from 'node:fs/promises';
const out=path.join(evidence,'game-art');
await fs.mkdir(out,{recursive:true});
const browser=await launch('chromium',true);
const report={browser:browser.version(),renderer:process.env.PORTAL_QA_SOFTWARE_GL==='1'?'SwiftShader software WebGL':'Browser default WebGL',sourceHashes:await sourceHashes(),views:[],motion:{}};
async function sheet(items,file){const width=600,height=260;const cells=[];for(let i=0;i<items.length;i++){const left=i%3*width,top=Math.floor(i/3)*height;cells.push({input:await sharp(items[i].buffer).resize(width,height-22).png().toBuffer(),left,top:top+22});cells.push({input:Buffer.from(`<svg width="600" height="22"><rect width="600" height="22" fill="#102922"/><text x="12" y="16" font-family="sans-serif" font-size="13" fill="white">${items[i].name}</text></svg>`),left,top});}await sharp({create:{width:width*3,height:height*Math.ceil(items.length/3),channels:3,background:'#102922'}}).composite(cells).png().toFile(`${out}/${file}`);}
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage();
  await page.goto(base,{waitUntil:'networkidle'});await page.locator('[data-open-avatar-gallery]').first().click();await page.waitForFunction(()=>document.querySelectorAll('[data-evolution-svg]').length===6);
  await page.locator('[data-evolution-mode="3d"]').click();await page.waitForFunction(()=>document.querySelector('[data-avatar-evolution]').dataset.modelReady==='true');
  const opening=[],latest=[];
  for(let i=0;i<6;i++){
    await page.locator(`[data-evolution-select="${i}"]`).click();await page.waitForFunction(()=>document.querySelector('[data-avatar-evolution]').dataset.modelReady==='true');
    for(const [name,orbit] of [['opening','-28deg 76deg 92%'],['front','0deg 78deg 100%'],['right','90deg 78deg 100%'],['rear','180deg 78deg 100%'],['left','270deg 78deg 100%'],['above','-28deg 40deg 100%'],['low','-28deg 100deg 100%']]){
      await page.locator('model-viewer').evaluate((el,orbit)=>{el.cameraOrbit=orbit;el.jumpCameraToGoal();},orbit);await page.waitForTimeout(150);
      const buffer=await page.locator('[data-evolution-canvas]').screenshot();const meta=await page.locator('[data-evolution-meta]').textContent();
      if(name==='opening')opening.push({name:meta.split(' • ')[0],buffer});if(i===5&&name!=='opening')latest.push({name,buffer});
      report.views.push({version:meta.match(/v\d+\.\d+\.\d+/)[0],name,orbit,ready:true});
    }
  }
  await sheet(opening,'lineage.png');await sheet(latest,'latest-orbits.png');
  await page.locator('model-viewer').evaluate(el=>{el.cameraOrbit='-28deg 76deg 92%';el.jumpCameraToGoal();});
  const poses=[];
  for(const [name,time] of [['neutral',0],['blink',2.82],['breath',1]]){
    const transform=await page.locator('model-viewer').evaluate((el,time)=>{el.pause();el.currentTime=time;let proto=el,sceneSymbol;while(proto&&!sceneSymbol){sceneSymbol=Object.getOwnPropertySymbols(proto).find(s=>s.description==='scene');proto=Object.getPrototypeOf(proto);}const scene=el[sceneSymbol];const pose={};scene.traverse(node=>{if(['HeadRig','EyeRig_L','EyeRig_R','ShellRig'].includes(node.name))pose[node.name]={position:node.position.toArray(),quaternion:node.quaternion.toArray(),scale:node.scale.toArray()};});return pose;},time);
    await page.waitForTimeout(150);poses.push({name,buffer:await page.locator('[data-evolution-canvas]').screenshot()});report.motion[name]=transform;
  }
  await sheet(poses,'idle-poses.png');
  if(report.motion.blink.EyeRig_L.scale[1]>.15||report.motion.neutral.EyeRig_L.scale[1]<.95)throw new Error('Blink rig did not animate');
  if(report.motion.neutral.HeadRig.position[1]===report.motion.breath.HeadRig.position[1])throw new Error('Breathing rig did not animate');
  console.log('Rendered 42 version/orbit views; actual rig transforms prove blink and breathing.');
}finally{await fs.writeFile(`${out}/visual-review.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
