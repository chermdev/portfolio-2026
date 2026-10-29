async page => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const assert=(ok,message)=>{if(!ok)throw Error(message)};
  const summary=()=>page.getByRole('region',{name:'Loan result'});
  const value=async label=>summary().locator('.data-row').filter({has:page.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').innerText();
  for(const kind of ['auto','mortgage']) {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto('http://127.0.0.1:3006/tools/'+(kind==='auto'?'auto-loan-calculator':'mortgage-calculator'));
    await page.getByRole('spinbutton',{name:kind==='auto'?/^Vehicle price/:/^Home price/}).fill('15000');
    await page.getByRole('spinbutton',{name:/^Annual interest rate/}).fill('0');
    await page.getByRole('spinbutton',{name:/^Term in months/}).fill('12');
    await page.getByRole('button',{name:'Add principal deposit',exact:true}).click();
    await page.getByRole('spinbutton',{name:/^Deposit 1 amount/}).fill('3000');
    assert(await value('Number of payments')==='9','Shorter term '+kind);
    assert(await value('Extra principal applied')==='MX$3,000.00','Actual deposit '+kind);
    await page.getByRole('button',{name:'View payment schedule',exact:true}).click();
    assert(await page.locator('#schedule tbody tr').count()===9,'Shorter table '+kind);
    await page.getByRole('radiogroup',{name:'Principal deposit strategy',exact:true}).getByRole('radio',{name:'Monthly payment',exact:true}).click();
    assert(await value('Number of payments')==='12','Recast term '+kind);
    assert(await value('Payment after first deposit')==='MX$727.27','Recast payment '+kind);
    assert(await page.locator('#schedule tbody tr').count()===12,'Recast table '+kind);
    const downloadPromise=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download payment schedule',exact:true}).click();
    const download=await downloadPromise;
    await download.saveAs('/Users/chsh/repos/portfolio-2026/artifacts/qa/'+kind+'-deposits.csv');
    await page.getByRole('button',{name:'Add principal deposit',exact:true}).click();
    await page.getByRole('spinbutton',{name:/^Deposit 2 amount/}).fill('20000');
    assert(await value('Number of payments')==='1','Cap and aggregate '+kind);
    assert(await value('Extra principal applied')==='MX$11,000.00','Cap actual '+kind);
    await page.getByRole('spinbutton',{name:/^Deposit 2 month/}).fill('13');
    await summary().getByRole('alert').waitFor();
    assert(await summary().locator('.result-value').count()===0,'Invalid suppressed '+kind);
    await page.getByRole('button',{name:'Remove deposit 2',exact:true}).click();
    await page.getByRole('radio',{name:'Purchasing power',exact:true}).click();
    assert(await summary().locator('.result-value').count()===1,'Power mode '+kind);
    await page.setViewportSize({width:390,height:844});
    await page.locator('#principal-deposits-heading').scrollIntoViewIfNeeded();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+kind);
    await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/'+kind+'-deposits-mobile.png'});
    await page.getByRole('button',{name:'Remove deposit 1',exact:true}).click();
    assert(await page.getByRole('spinbutton',{name:/^Deposit 1 amount/}).count()===0,'Remove '+kind);
    assert(!await page.locator('main').innerText().then(text=>/Toyota/i.test(text)),'No inspiration copy');
  }
  assert(errors.length===0,errors.join(';'));
  return {status:'passed',checks:'both loan tools: strategies, table, CSV, multiple/capped deposits, invalid month, purchasing power, mobile, removal'};
}
