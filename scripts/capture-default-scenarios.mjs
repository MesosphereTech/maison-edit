// Capture real rendered preset UI without provider calls or personal uploads.
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';
import headless from '@sparticuz/chromium';
import {initialState,STORAGE_KEY} from '../src/data.js';
const port=4187,base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe'});
let browser;
try {
  for(let n=0;n<100;n++){if(await fetch(base).then(r=>r.ok).catch(()=>false))break;await sleep(100);}
  browser=await chromium.launch({executablePath:await headless.executablePath(),headless:true,args:headless.args,env:{...process.env,HOME:'/tmp'}});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage();await page.goto(base,{waitUntil:'networkidle'});
  await page.evaluate(({key,state})=>localStorage.setItem(key,JSON.stringify(state)),{key:STORAGE_KEY,state:{...initialState(),language:'zh'}});
  await page.reload({waitUntil:'networkidle'});
  await page.screenshot({path:'artifacts/final-default-person-desktop.png',fullPage:false});
  await page.setViewportSize({width:1440,height:1200});
  const scenario=page.locator('.test-scenario');await scenario.scrollIntoViewIfNeeded();await scenario.screenshot({path:'artifacts/final-default-home-desktop.png'});
  await page.getByRole('button',{name:'编辑人物与空间',exact:true}).count();
  await page.getByRole('button',{name:'调整默认场景',exact:true}).click();
  await page.getByRole('dialog').screenshot({path:'artifacts/final-default-person-settings.png'});
  await page.getByRole('button',{name:'Close / 关闭',exact:true}).click();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'artifacts/final-default-person-mobile.png',fullPage:false});
  await page.setViewportSize({width:390,height:1400});await scenario.scrollIntoViewIfNeeded();await scenario.screenshot({path:'artifacts/final-default-home-mobile.png'});
  console.log('Captured five actual default scenario views. No uploads or provider calls.');
} finally {await browser?.close();server.kill();}
