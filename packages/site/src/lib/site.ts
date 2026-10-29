export const site = {
  name: 'chermdev', github: 'https://github.com/chermdev', linkedin: 'https://www.linkedin.com/in/chermdev/',
  description: 'Charlie (chermdev) builds useful apps and automates repetitive work with bots and AI. Free browser tools and projects.',
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
export const projects = [
  { name: 'dji-serie-checker', description: 'A community-run, independent checker for DJI serial numbers.', kind: 'Web app', stack: 'JavaScript', href: repo('dji-serie-checker') },
  { name: 'hackafor-api', description: 'The API behind Price Fighter, a game built for the Hackafor hackathon.', kind: 'API', stack: 'Python · FastAPI · Supabase', href: repo('hackafor-api') },
  { name: 'bot-pixelpage-drawer', description: 'A bot that paints pixel art on pixelpage by sending requests in parallel.', kind: 'Bot', stack: 'Python', href: repo('bot-pixelpage-drawer') },
  { name: 'crawler-s24-stock-checker', description: 'Checks Samsung Galaxy S24 Ultra stock in Mexico, so I didn’t have to.', kind: 'Crawler', stack: 'TypeScript', href: repo('crawler-s24-stock-checker') },
  { name: 'skills', description: 'Skills I reuse across projects.', kind: 'AI', stack: 'Python', href: repo('skills') },
  { name: 'conventional-commits-setup', description: 'Add conventional commits to any project in three steps.', kind: 'Dev tooling', stack: 'Shell · commitlint', href: repo('conventional-commits-setup') },
] as const;
