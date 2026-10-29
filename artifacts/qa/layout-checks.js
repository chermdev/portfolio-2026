async page => {
  const base='http://127.0.0.1:4173';
  const errors=[]; page.on('pageerror', error=>errors.push(error.message));
  const assert=(condition,message)=>{if(!condition)throw new Error(message)};
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/');
  await page.locator('[data-sculpture][data-ready]').waitFor({timeout:15000});
  await page.getByRole('button',{name:'Pause sculpture animation'}).click();
  assert(await page.locator('[data-pause]').getAttribute('aria-pressed')==='true','Pause control');
  await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/home-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Toggle light and dark theme'}).click();
  assert(await page.locator('html').evaluate(el=>el.classList.contains('dark')),'Dark toggle');
  await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/home-dark.png'});
  await page.reload();
  assert(await page.locator('html').evaluate(el=>el.classList.contains('dark')),'Theme persistence');
  await page.getByRole('button',{name:'Toggle light and dark theme'}).click();
  for(const width of [390,320]){
    await page.setViewportSize({width,height:844});
    for(const path of ['/','/projects','/tools','/tools/stripe-calculator','/tools/auto-loan-calculator','/tools/mortgage-calculator','/notes','/learn','/projects/objects-of-curiosity','/system-design']){
      await page.goto(base+path);
      assert(await page.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`Overflow at ${width}: ${path}`);
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('[data-enter]')).every(el=>Number(getComputedStyle(el).opacity)===1));
  await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/home-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Open navigation'}).click();
  assert(await page.getByRole('dialog').isVisible(),'Mobile navigation opens');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  assert(await page.locator('[data-sculpture]').getAttribute('data-ready')===null,'Reduced motion avoids WebGL');
  assert(await page.locator('[data-sculpture] img').evaluate(image=>image.complete && image.naturalWidth>0),'Reduced motion still loads');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base+'/projects/objects-of-curiosity');
  await page.locator('[data-sculpture][data-ready]').waitFor();
  await page.getByLabel('Material',{exact:true}).selectOption('wireframe');
  assert(await page.getByLabel('Material',{exact:true}).inputValue()==='wireframe','Material control');
  assert(errors.length===0,errors.join(';'));
  return {status:'passed',checked:'desktop, dark persistence, 320/390px routes, mobile menu, reduced motion, sculpture controls'};
}
