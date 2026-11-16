import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
let count=0;
async function walk(dir,base=dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file,base);else if(item.name.endsWith('.html'))await check(file,base);}}
async function check(file,appDir){
 const html=await readFile(file,'utf8');
 const spanish=path.relative(appDir,file).startsWith('es/');
 if(!html.includes(`lang="${spanish?'es':'en'}"`))throw Error(`${file}: wrong document language`);
 for(const language of ['en','es'])if(!html.includes(`hreflang="${language}"`))throw Error(`${file}: missing language alternative`);
 const get=attribute=>html.match(new RegExp(`<meta[^>]+(?:name|property)="${attribute}"[^>]+content="([^"]+)"`))?.[1];
 for(const field of ['description','og:title','og:image','og:image:alt','twitter:card'])if(!get(field))throw Error(`${file}: missing ${field}`);
 if(get('og:image:width')!=='1200'||get('og:image:height')!=='630')throw Error('OG dimensions missing');
 if(spanish&&!get('og:image')?.endsWith('-es.png'))throw Error(`${file}: wrong localized OG image`);
 const image=new URL(get('og:image'));
 const buffer=await readFile(path.join(root,'apps/web/public',image.pathname));
 if(buffer.readUInt32BE(16)!==1200||buffer.readUInt32BE(20)!==630)throw Error('Wrong image dimensions');
 if((html.match(/<h1(?:\s|>)/g)||[]).length!==1)throw Error(`${file}: expected one h1`);
 if(!html.includes('rel="canonical"'))throw Error(`${file}: missing canonical`);
 if(file.includes('/tools/')&&!file.endsWith('/tools/index.html')&&!/"applicationCategory":"(Finance|Multimedia|Lifestyle)Application"/.test(html))throw Error(`${file}: missing tool structured data`);
 for(const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)(?:[?#][^"]*)?"/g)){
  const value=match[1];if(value.startsWith('//')||value.startsWith('/_astro/'))continue;
  const target=path.join(appDir,value);
  let exists=false;for(const candidate of [target,path.join(target,'index.html')]){try{await stat(candidate);exists=true;break;}catch{}}
  if(!exists)throw Error(`${file}: broken internal URL ${value}`);
 }
 count++;
}
// Apps with a server adapter (web, on Vercel) write their pages to dist/client.
for(const app of ['web','blog','learn','admin']){const dist=path.join(root,'apps',app,'dist');await walk(await stat(path.join(dist,'client')).then(()=>path.join(dist,'client'),()=>dist));}
console.log(`Verified ${count} HTML pages: metadata, canonical, headings, local links, 1200×630 OG assets, tool schema.`);
