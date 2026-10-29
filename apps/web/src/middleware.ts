import { defineMiddleware } from 'astro:middleware';
import { localizeResponse } from '@portfolio/i18n/middleware';
export const onRequest = defineMiddleware((context, next) => localizeResponse(context, next, [import.meta.env.PUBLIC_PORTFOLIO_URL, import.meta.env.PUBLIC_BLOG_URL, import.meta.env.PUBLIC_LEARN_URL].filter((value): value is string => Boolean(value))));
