const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('playwright'),r=require('../../js/gridlyMarkerRegistry.js');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());
  const checks=[];
  for(const e of Object.values(r.entries)){
   const src='data:image/svg+xml;base64,'+fs.readFileSync(r.basePath+e.asset).toString('base64');
   const check=await page.evaluate(async({src,condition})=>{
    const img=new Image();img.src=src;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,256,256);
    const data=ctx.getImageData(0,0,256,256).data;let edgeAlpha=0;
    for(let i=0;i<256;i++)for(const [x,y]of [[i,0],[i,255],[0,i],[255,i]])edgeAlpha=Math.max(edgeAlpha,data[(y*256+x)*4+3]);
    canvas.width=canvas.height=64;ctx.drawImage(img,0,0,64,64);
    const small=ctx.getImageData(0,0,64,64).data;let whitePixels=0,navyPixels=0;
    for(let i=0;i<small.length;i+=4){if(small[i+3]>200&&small[i]>210&&small[i+1]>210&&small[i+2]>210)whitePixels++;if(small[i+3]>200&&small[i]<35&&small[i+1]<65&&small[i+2]<85)navyPixels++;}
    return{condition,edgeAlpha,whitePixels,navyPixels,naturalWidth:img.naturalWidth};
   },{src,condition:e.condition});
   assert.equal(check.edgeAlpha,0,'Unclipped transparent exterior: '+e.condition);
   assert.ok(check.whitePixels>35,'Visible white pictogram: '+e.condition);
   assert.ok(check.navyPixels>check.whitePixels,'Navy dominant: '+e.condition);
   checks.push(check);
  }
  fs.writeFileSync('reports/lp24447a-vector-render-evidence.json',JSON.stringify({renderer:'Edge canvas, no network',scale:64,checks},null,2)+'\n');
  console.log('PASS: all '+checks.length+' vectors decode, have unclipped transparent boundaries and visible white-on-navy content at 64px');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
