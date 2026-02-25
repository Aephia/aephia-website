import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import rss from '@astrojs/rss';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://posts.aephia.com', // Placeholder domain, can be updated
  integrations: [mdx(), sitemap()],
  output: 'static',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'dracula',
    },
  },
  vite: {
    server: {
      fs: {
        allow: ['../..', '../../../../staratlas/medium'],
      },
    },
  },
});
