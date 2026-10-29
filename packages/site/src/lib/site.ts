export const site = {
  name: 'chermdev', github: 'https://github.com/chermdev',
  description: 'Developer, builder, and curious human. Explore my projects, useful calculators, and experiments on the web.',
  url: import.meta.env.PUBLIC_SITE_URL || 'https://portfolio.example',
};
export const destinations = { blog: import.meta.env.PUBLIC_BLOG_URL || '/notes', learn: import.meta.env.PUBLIC_LEARN_URL || '/learn' };
export const tools = [
  { slug: 'stripe-calculator', name: 'Stripe fee calculator', description: 'Know what you keep. Work forwards or backwards, in MXN or USD.', tag: 'Payments', icon: 'stripe' },
  { slug: 'auto-loan-calculator', name: 'Auto loan calculator', description: 'Find your monthly payment, or the car that fits your budget.', tag: 'Auto finance', icon: 'car' },
  { slug: 'mortgage-calculator', name: 'Mortgage calculator', description: 'Explore your monthly payment and how much home you can afford.', tag: 'Home finance', icon: 'home' },
] as const;
