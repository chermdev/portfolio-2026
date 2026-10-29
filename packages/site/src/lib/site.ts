export const site = {
  name: 'chermdev', github: 'https://github.com/chermdev', linkedin: 'https://www.linkedin.com/in/chermdev/',
  description: 'Charlie (chermdev) builds websites, apps, and automations. Free browser tools and projects.',
  url: import.meta.env.PUBLIC_SITE_URL || 'https://portfolio.example',
};
export const destinations = { blog: import.meta.env.PUBLIC_BLOG_URL || '/notes', learn: import.meta.env.PUBLIC_LEARN_URL || '/learn' };
export const tools = [
  { category: 'Finance', slug: 'stripe-calculator', name: 'Stripe fee calculator', description: 'Know what you keep. Work forwards or backwards, in MXN or USD.', tag: 'Payments', icon: 'stripe' },
  { category: 'Finance', slug: 'auto-loan-calculator', name: 'Auto loan calculator', description: 'Find your monthly payment, or the car that fits your budget.', tag: 'Auto finance', icon: 'car' },
  { category: 'Finance', slug: 'mortgage-calculator', name: 'Mortgage calculator', description: 'Explore your monthly payment and how much home you can afford.', tag: 'Home finance', icon: 'home' },
  { category: 'Finance', slug: 'compound-interest-calculator', name: 'Compound interest calculator', description: 'See how your savings could grow with regular contributions.', tag: 'Savings', icon: 'savings' },
] as const;
// ponytail: planned tools are listed so visitors see where the toolbox is going; remove an entry once it ships in `tools`.
export const upcomingTools = [
  { name: 'Image compressor', description: 'Shrink images in your browser. Files never leave your device.', category: 'Media', icon: 'image' },
  { name: 'Video compressor', description: 'Compress video locally with WebCodecs. No uploads.', category: 'Media', icon: 'video' },
] as const;
const repo = (name: string) => `https://github.com/chermdev/${name}`;
// Projects with an `image` (a screenshot in apps/web/src/assets/projects) get a visual card; the rest are listed as rows.
export const projects = [
  { name: 'El Bocadito', description: 'Website for a boneless and wings restaurant: menu, promotions, and orders over WhatsApp.', kind: 'Website', stack: 'Next.js', href: 'https://www.elbocaditogpe.com/', domain: 'elbocaditogpe.com', image: 'bocadito' },
  { name: 'CER Psicología', description: 'Website for a child psychology and early stimulation center, with services, locations, and reviews from families.', kind: 'Website', stack: 'Next.js', href: 'https://cerpsicologia.com/', domain: 'cerpsicologia.com', image: 'cer' },
  { name: 'DJI Serie Checker', description: 'Check whether a serial number is on the list of stolen equipment before you buy it. Scan it with your camera; everything stays on your device.', kind: 'Web app', stack: 'JavaScript', href: 'https://dji-serie-checker.vercel.app/', domain: 'dji-serie-checker.vercel.app', image: 'dji-serie-checker' },
  { name: 'skills', description: 'Skills for AI agents that I reuse across projects.', kind: 'AI', stack: 'Python', href: repo('skills') },
  { name: 'conventional-commits-setup', description: 'Add conventional commits to any project in three steps.', kind: 'Dev tooling', stack: 'Shell · commitlint', href: repo('conventional-commits-setup') },
  { name: 'Northside', description: 'Website for a web design and development studio: identity, websites, and online stores.', kind: 'Website', stack: 'Astro · Tailwind', href: 'https://northside-app.vercel.app/', domain: 'northside-app.vercel.app', image: 'northside' },
  { name: 'crawler-s24-stock-checker', description: 'Checks Samsung Galaxy S24 Ultra stock in Mexico, so I didn’t have to.', kind: 'Crawler', stack: 'TypeScript', href: repo('crawler-s24-stock-checker') },
  { name: 'bot-pixelpage-drawer', description: 'A bot that paints pixel art on pixelpage by sending requests in parallel.', kind: 'Bot', stack: 'Python', href: repo('bot-pixelpage-drawer') },
] as const;
