import { parse, serialize, type DefaultTreeAdapterMap } from 'parse5';
import { localeFromPath, localizePath, translate } from './index.ts';
type Node = DefaultTreeAdapterMap['node'];
/** Translate static Astro markup on the server, never mutate a hydrated React DOM. */
export async function localizeResponse(context: { url: URL }, next: () => Promise<Response>, linkedOrigins: string[] = []) {
  const response = await next();
  const locale = localeFromPath(context.url.pathname);
  if (locale !== 'es' || !response.headers.get('content-type')?.includes('text/html')) return response;
  const document = parse(await response.text(), { scriptingEnabled: false });
  function visit(node: Node) {
    if ('tagName' in node && node.tagName === 'script' && node.attrs.some(attr => attr.name === 'type' && attr.value === 'application/ld+json')) {
      for (const child of node.childNodes) if ('value' in child) {
        const data = JSON.parse(child.value);
        const localizeSchema = (value: unknown): unknown => {
          if (Array.isArray(value)) return value.map(localizeSchema);
          if (!value || typeof value !== 'object') return value;
          return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, ['name', 'description'].includes(key) && typeof item === 'string' ? translate(item, locale) : localizeSchema(item)]));
        };
        child.value = JSON.stringify(localizeSchema(data)).replace(/</g, '\\u003c');
      }
    }
    if ('tagName' in node && ['script', 'style', 'astro-island'].includes(node.tagName)) return;
    if (node.nodeName === '#text' && 'value' in node && node.value.trim()) {
      const whitespace = node.value.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
      node.value = whitespace[1] + translate(whitespace[2], locale) + whitespace[3];
    }
    if ('attrs' in node) {
      for (const attr of node.attrs) {
        if (['alt', 'title', 'aria-label', 'placeholder'].includes(attr.name)) attr.value = translate(attr.value, locale);
        if (attr.name === 'href' && node.tagName === 'a' && !/\.[a-z]+(?:[?#]|$)/i.test(attr.value)) {
          const isLocal = attr.value.startsWith('/') || linkedOrigins.some(origin => attr.value.startsWith(origin.replace(/\/$/, '') + '/'));
          if (isLocal) attr.value = localizePath(attr.value, locale);
        }
        if (node.tagName === 'meta' && attr.name === 'content' && node.attrs.some(a => ['name','property'].includes(a.name) && ['description','og:title','og:description','og:image:alt','twitter:title','twitter:description','twitter:image:alt'].includes(a.value))) attr.value = translate(attr.value, locale);
      }
    }
    if ('childNodes' in node) for (const child of node.childNodes) visit(child);
  }
  visit(document);
  const headers = new Headers(response.headers); headers.delete('content-length');
  return new Response(serialize(document), { status: response.status, headers });
}
