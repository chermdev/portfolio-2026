async page => {
  await page.setViewportSize({width:1440,height:1000});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/system-design');
  const names=await page.locator('aside button').allTextContents();
  for(const name of names){
    await page.locator('aside').getByRole('button',{name,exact:true}).click();
    const heading=await page.locator('#component-preview h2').innerText();
    if(heading!==name)throw new Error('Gallery selection failed: '+name);
    if(errors.length)throw new Error(name+': '+errors.join(';'));
  }
  await page.locator('aside').getByRole('button',{name:'dialog',exact:true}).click();
  await page.getByRole('button',{name:'Open dialog',exact:true}).click();
  await page.getByRole('heading',{name:'A moment of focus'}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('aside').getByRole('button',{name:'button',exact:true}).click();
  await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/design-system.png',fullPage:true});
  return {count:names.length,errors,status:'All component previews mounted; dialog keyboard dismissal passed'};
}
