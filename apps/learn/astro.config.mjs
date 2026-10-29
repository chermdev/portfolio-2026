import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://learn.portfolio.example',
  publicDir: '../web/public',
  integrations: [react(), sitemap()],
  vite: { cacheDir: process.env.npm_lifecycle_event === 'build' ? 'node_modules/.vite-build' : 'node_modules/.vite-dev', plugins: [tailwindcss()], ssr: { noExternal: ['@portfolio/i18n', '@portfolio/site', '@portfolio/ui', '@fontsource-variable/manrope'] } },
});
