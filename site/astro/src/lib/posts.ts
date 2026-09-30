/**
 * The addresses of the posts, shared by each post's page and its Markdown so
 * that the two cannot drift apart.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { asTyped, componentsLeft, toPlainMarkdown, type MarkdownPost } from './page-markdown';

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

const warned = new Set<string>();

/** Once for each post, on a line of its own between those with which the build reports its progress. */
function warn(post: Post, message: string): void {
  const name = `${post.collection}/${post.id}`;
  if (warned.has(name)) return;

  warned.add(name);
  console.warn(`\n[markdown] ${name}: ${message} See src/lib/page-markdown.ts.`);
}

/**
 * The Markdown of a post does not stop the build: the post is published, as
 * it was typed where it could not be rewritten.
 */
function rewritten(post: Post, written: MarkdownPost, site: URL): string {
  try {
    const markdown = toPlainMarkdown(written, site);
    const left = componentsLeft(markdown);
    if (left.length > 0) warn(post, `${left.map((component) => `<${component}>`).join(', ')} is not rewritten as Markdown.`);

    return markdown;
  } catch (error) {
    warn(post, `could not be rewritten as Markdown (${error instanceof Error ? error.message : error}).`);

    return asTyped(written);
  }
}

export function postMarkdown(post: Post, site: URL | undefined): string {
  const { title, date, author } = post.data;
  const source = 'source' in post.data ? post.data.source : undefined;

  return rewritten(post, { title, date, author: author?.name, source, body: post.body ?? '' }, requireSite(site));
}

export function markdownResponse(post: Post, site: URL | undefined): Response {
  return new Response(postMarkdown(post, site), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
}
