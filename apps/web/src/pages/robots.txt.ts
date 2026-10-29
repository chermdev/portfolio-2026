import type { APIRoute } from 'astro';
import { site } from '@portfolio/site/lib/site';
export const GET: APIRoute = () => new Response(`User-agent: *\n${site.url.includes('.example') ? 'Disallow: /' : 'Allow: /\nDisallow: /system-design'}\nSitemap: ${site.url}/sitemap-index.xml\n`, { headers: { 'Content-Type': 'text/plain' } });
