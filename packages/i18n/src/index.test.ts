import test from 'node:test';
import assert from 'node:assert/strict';
import { localeFromPath, localizePath, translate } from './index.ts';
import { localizeResponse } from './middleware.ts';

test('language routes preserve page paths, anchors, and configured subdomains', () => {
 assert.equal(localeFromPath('/es/tools'), 'es');
 assert.equal(localeFromPath('/espanol'), 'en');
 assert.equal(localizePath('/es/tools', 'en'), '/tools');
 assert.equal(localizePath('/tools?mode=payment#results', 'es'), '/es/tools?mode=payment#results');
 assert.equal(localizePath('/es/tools', 'es'), '/es/tools');
 assert.equal(localizePath('https://blog.example.com/article?x=1#more', 'es'), 'https://blog.example.com/es/article?x=1#more');
 assert.equal(localizePath('/404.html', 'es'), '/es/404/');
 assert.equal(localizePath('/es/404/', 'en'), '/404.html');
});
test('translated placeholders and calculator validation retain numeric values', () => {
 assert.equal(translate('Deposit {n} amount', 'es', {n: 3}), 'Monto de la aportación 3');
 assert.equal(translate('Deposit month must be between 1 and 60.', 'es'), 'El mes de la aportación debe estar entre 1 y 60.');
 assert.equal(translate('Principal must be between 0 and 1000000000.', 'es'), 'Capital debe estar entre 0 y 1000000000.');
 assert.equal(translate('Mortgage calculator | chermdev', 'es'), 'Simulador de crédito hipotecario | chermdev');
});
test('static localization translates metadata/noscript but leaves React islands and scripts intact', async () => {
 const html='<html><head><title>Mortgage calculator | chermdev</title><meta name="description" content="Monthly payment"></head><body><h1>Monthly payment</h1><a href="/tools">Tools</a><noscript>Enable JavaScript to use the interactive calculator. The formulas and assumptions are explained below.</noscript><astro-island><button>Monthly payment</button></astro-island><script>const x = "Monthly payment";</script><script type="application/ld+json">{"name":"Mortgage calculator"}</script></body></html>';
 const response=await localizeResponse({url:new URL('https://example.com/es/tools')},async()=>new Response(html,{headers:{'content-type':'text/html'}}));
 const result=await response.text();
 assert.ok(result.includes('<h1>Mensualidad</h1>'));
 assert.ok(result.includes('href="/es/tools"'));
 assert.ok(result.includes('content="Mensualidad"'));
 assert.ok(result.includes('<noscript>Activa JavaScript'));
 assert.ok(result.includes('<astro-island><button>Monthly payment</button></astro-island>'));
 assert.ok(result.includes('const x = "Monthly payment"'));
 assert.ok(result.includes('"name":"Simulador de crédito hipotecario"'));
});
test('savings calculator validation is translated', () => {
 assert.equal(translate('Monthly contribution must be between 0 and 1000000000.', 'es'), 'Aportación mensual debe estar entre 0 y 1000000000.');
 assert.equal(translate('Your balance after {years} years', 'es', {years: 10}), 'Tu saldo después de 10 años');
});
