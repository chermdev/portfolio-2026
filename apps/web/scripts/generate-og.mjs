import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
const require = createRequire(import.meta.url);
const fontPath = require.resolve('@fontsource/manrope/files/manrope-latin-500-normal.woff');
const font = fontkit.create(await readFile(fontPath));
const css = await readFile(new URL('../../../packages/ui/src/styles.css', import.meta.url), 'utf8');
const token = (name) => css.match(new RegExp(`--${name}: (#[0-9a-fA-F]+);`))?.[1];
const background = token('background'), ink = token('foreground'), muted = token('muted-foreground');
const sculpture = (await readFile(new URL('../public/sculpture.png', import.meta.url))).toString('base64');
function textPaths(text, x, y, size, color, tracking = 0) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = 0;
  return run.glyphs.map((glyph, index) => {
    const position = run.positions[index];
    const output = `<path fill="${color}" transform="translate(${x + cursor + position.xOffset * scale} ${y - position.yOffset * scale}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
    cursor += position.xAdvance * scale + tracking;
    return output;
  }).join('');
}
const cards = {
  home: [['Thoughtful code.', 'Useful things.'], 'A developer’s space to build, explore, and share.'],
  projects: [['Ideas,', 'made real.'], 'Projects and experiments by chermdev.'],
  tools: [['Less guesswork.', 'More clarity.'], 'Free calculators for payments and bigger purchases.'],
  stripe: [['Know what', 'you keep.'], 'Stripe fees, in MXN and USD. Both directions.'],
  auto: [['Your next car.', 'Your numbers.'], 'Monthly payments and purchasing power.'],
  mortgage: [['Put a home', 'in perspective.'], 'A clear, flexible mortgage calculator.'],
  savings: [['Watch your', 'savings grow.'], 'A compound interest calculator for regular savers.'],
  notes: [['Notes from', 'the workbench.'], 'Thoughts on building things for the web.'],
  learn: [['Make room', 'for curiosity.'], 'Look inside the ideas behind the tools.'],
};
Object.assign(cards, {
  'home-es': [['Código con', 'intención.'], 'Un espacio para crear, explorar y compartir.'],
  'projects-es': [['Ideas hechas', 'realidad.'], 'Proyectos y experimentos de chermdev.'],
  'tools-es': [['Menos dudas.', 'Más claridad.'], 'Calculadoras gratuitas para tus decisiones.'],
  'stripe-es': [['Tus cobros.', 'Más claros.'], 'Comisiones de Stripe en MXN y USD.'],
  'auto-es': [['Tu próximo', 'auto.'], 'Mensualidades y capacidad de compra.'],
  'mortgage-es': [['Tu próxima', 'casa.'], 'Un simulador hipotecario claro y flexible.'],
  'savings-es': [['Haz crecer', 'tus ahorros.'], 'Un simulador de interés compuesto para ahorrar.'],
  'notes-es': [['Notas del', 'taller.'], 'Ideas sobre crear cosas para la web.'],
  'learn-es': [['Espacio para', 'la curiosidad.'], 'Descubre las ideas detrás de las herramientas.'],
});
const out = new URL('../public/og/', import.meta.url);
await mkdir(out, { recursive: true });
await mkdir(new URL('../artifacts/og/', import.meta.url), { recursive: true });
for (const [name, [lines, description]] of Object.entries(cards)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="${background}"/>${textPaths('chermdev.', 64, 84, 30, ink, -1)}<image x="645" y="38" width="585" height="585" xlink:href="data:image/png;base64,${sculpture}"/>${lines.map((line, i) => textPaths(line, 64, 280 + i * 91, 78, ink, -3.5)).join('')}${textPaths(description, 68, 468, 23, muted, -0.3)}<path d="M64 548H1136" stroke="${token('border')}"/>${textPaths(name.endsWith('-es') ? 'Herramientas, proyectos y un poco de curiosidad.' : 'Tools, projects & a little curiosity.', 68, 588, 18, muted)}</svg>`;
  const source = new URL(`../artifacts/og/${name}.svg`, import.meta.url);
  await writeFile(source, svg);
  await sharp(Buffer.from(svg)).png().toFile(new URL(`${name}.png`, out).pathname);
  await sharp(Buffer.from(svg)).resize(400, 210).png().toFile(new URL(`../artifacts/og/${name}-thumbnail.png`, import.meta.url).pathname);
  console.log(`${name}: 1200×630 PNG + editable SVG + 400×210 proof`);
}
