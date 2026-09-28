/**
 * The addresses of the posts, shared by each post's page and its Markdown so
 * that the two cannot drift apart.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { toPlainMarkdown } from './page-markdown';

type Post = CollectionEntry<'posts'> | CollectionEntry<'sa-medium'>;

// Map Content type (singular) to URL type (plural)
const contentTypeToUrl: Record<string, string> = {
  newsletter: 'newsletters',
  guide: 'guides',
  news: 'news',
  aephia: 'aephia',
};

export async function postPaths() {
  const posts = await getCollection('posts');

  return posts.map((post) => ({
    params: { type: contentTypeToUrl[post.data.type.toLowerCase()] || 'news', slug: post.slug },
    props: { post },
  }));
}

export async function saMediumPaths() {
  const posts = await getCollection('sa-medium');

  return posts.map((post) => ({
    params: { slug: post.data.slug || post.slug || post.id.replace(/\.mdx?$/, '') },
    props: { post },
  }));
}

/** Links in the Markdown need the site's full address. */
export function requireSite(site: URL | undefined): URL {
  if (!site) throw new Error('`site` must be set in astro.config.mjs: Markdown links need the full address');

  return site;
}

export function postMarkdown(post: Post, site: URL | undefined): string {
  const { title, date, author } = post.data;
  const source = 'source' in post.data ? post.data.source : undefined;

  return toPlainMarkdown({ title, date, author: author?.name, source, body: post.body ?? '' }, requireSite(site));
}

export function markdownResponse(post: Post, site: URL | undefined): Response {
  return new Response(postMarkdown(post, site), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
