async page => {
 const base='http://127.0.0.1:3006'; const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const assert=(ok,message)=>{if(!ok)throw Error(message)};
 const field=name=>page.getByRole('spinbutton',{name});
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'/tools/stripe-calculator');
 await page.getByRole('button',{name:'Reset calculator',exact:true}).click();
 await field(/^Payment amount/).fill('2345');
 await field(/^Processing rate/).fill('4.2');
 await page.getByRole('switch',{name:'International card',exact:true}).click();
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='2345');
 assert(await field(/^Processing rate/).inputValue()==='4.2','Stripe custom rate persisted');
 assert(await page.getByRole('switch',{name:'International card',exact:true}).getAttribute('aria-checked')==='true','Stripe toggle persisted');
 await page.getByRole('link',{name:'Cambiar a español',exact:true}).click();
 assert(await page.locator('html').getAttribute('lang')==='es','Spanish document language');
 await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='2345');
 assert(await page.locator('main h1').innerText()==='Calculadora de comisiones de Stripe','Spanish heading');
 await field(/^Comisión porcentual/).fill('100');
 await page.getByText('La tasa combinada y su impuesto deben ser menores al 100%.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Restablecer calculadora',exact:true}).click();
 assert(await field(/^Monto del cobro/).inputValue()==='1000','Stripe reset');
 await page.reload();
 assert(await field(/^Monto del cobro/).inputValue()==='1000','Stripe reset persisted');
 for(const [route,label,price] of [['auto-loan-calculator',/^Precio del auto/,'600000'],['mortgage-calculator',/^Precio de la casa/,'3500000']]) {
   await page.goto(base+'/es/tools/'+route);
   await page.getByRole('button',{name:'Restablecer calculadora',exact:true}).click();
   await field(label).fill(price);
   await page.getByRole('button',{name:'Agregar aportación',exact:true}).click();
   await field(/^Monto de la aportación 1/).fill('12345');
   await field(/^Mes de la aportación 1/).fill('3');
   await page.getByRole('radiogroup',{name:'Estrategia de aportaciones a capital'}).getByRole('radio',{name:'Mensualidad',exact:true}).click();
   await page.reload();
   await field(/^Monto de la aportación 1/).waitFor();
   assert(await field(label).inputValue()===price,'Loan price persisted '+route);
   assert(await field(/^Monto de la aportación 1/).inputValue()==='12345','Deposit persisted');
   assert(await field(/^Mes de la aportación 1/).inputValue()==='3','Deposit month persisted');
   assert(await page.getByRole('radiogroup',{name:'Estrategia de aportaciones a capital'}).getByRole('radio',{name:'Mensualidad',exact:true}).getAttribute('aria-checked')==='true','Strategy persisted');
   const downloadPromise=page.waitForEvent('download');
   await page.getByRole('button',{name:'Descargar amortización',exact:true}).click();
   const download=await downloadPromise; await download.saveAs('/Users/chsh/repos/portfolio-2026/artifacts/qa/'+route+'-es.csv');
 }
 await page.getByRole('button',{name:'Restablecer calculadora',exact:true}).click();
 assert(await field(/^Precio de la casa/).inputValue()==='2500000','Mortgage reset');
 assert(await field(/^Monto de la aportación/).count()===0,'Reset removes deposits');
 await page.goto(base+'/es/tools/auto-loan-calculator');
 await field(/^Monto de la aportación 1/).waitFor();
 assert(await field(/^Precio del auto/).inputValue()==='600000','Mortgage reset preserved auto');
 await page.getByRole('link',{name:'Switch to English',exact:true}).click();
 await field(/^Deposit 1 amount/).waitFor();
 assert(await field(/^Vehicle price/).inputValue()==='600000','Language switch preserved auto');
 await page.getByRole('button',{name:'Reset calculator',exact:true}).click();
 assert(await field(/^Vehicle price/).inputValue()==='450000','Auto reset');
 await page.goto(base+'/es/');
 assert((await page.locator('main h1').innerText()).includes('Código con intención.'),'Homepage translated');
 await page.evaluate(()=>localStorage.setItem('theme','light')); await page.reload();
 assert(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(255, 255, 255)','White theme');
 await page.getByRole('button',{name:'Cambiar entre tema claro y oscuro'}).click();
 assert(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)==='rgb(9, 9, 9)','Black theme');
 await page.screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/home-spanish-dark.png'});
 for(const width of [390,320]){
   await page.setViewportSize({width,height:844});
   for(const route of ['/es/','/es/tools/stripe-calculator','/es/tools/auto-loan-calculator','/es/tools/mortgage-calculator']){
    await page.goto(base+route);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'Overflow '+width+route);
   }
 }
 await page.getByRole('button',{name:'Agregar aportación',exact:true}).click();
 await page.getByRole('region',{name:'Aportaciones a capital',exact:true}).screenshot({path:'/Users/chsh/repos/portfolio-2026/artifacts/qa/deposits-spanish-dark.png'});
 await page.getByRole('button',{name:'Restablecer calculadora',exact:true}).click();
 await page.getByRole('button',{name:'Cambiar entre tema claro y oscuro'}).click();
 assert(errors.length===0,errors.join(';'));
 return {status:'passed',checks:'independent stores, reload, reset, locale navigation, translated validation/CSV, neutral themes, 320/390px layouts'};
}
