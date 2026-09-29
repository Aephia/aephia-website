/**
 * A post as plain Markdown: what "Copy" puts on the clipboard and what is
 * served at the post's address with `.md` appended.
 *
 * The posts are written in MDX. Their embed components mean nothing outside
 * this site, so each is rewritten as the Markdown that says the same thing,
 * and links are made absolute so that they still lead somewhere once the text
 * has been pasted elsewhere.
 *
 * The posts are written by a pipeline and built without review, so nothing
 * here may throw on what it does not understand: that stays as it was written.
 */
import { tweetAuthor } from './tweet.ts';

export interface MarkdownPost {
  title: string;
  date: Date;
  author?: string;
  /** Where the post was first published, when that is not this site. */
  source?: string;
  /** The post's MDX body, without its frontmatter. */
  body: string;
}

/** What stands in front of a component on its line, when it opens the line. */
const INDENT = '(^[ \\t]*)?';

/** The attributes of a component's tag. Quoted, so that a `>` in a value does not end the tag. */
const ATTRIBUTES = '((?:\\s+[\\w-]+="[^"]*")*)\\s*';

/** A block of code between fences, which may itself stand in a quotation. It ends with its fence or with the text. */
const FENCED_CODE = /^[ \t>]*(`{3,}|~{3,})[^\n`]*$[\s\S]*?(?:^[ \t>]*\1[`~]*[ \t]*$|(?![\s\S]))/gm;

/** Code within a line. It does not reach across an empty line, so that a stray backtick claims no more than its paragraph. */
const INLINE_CODE = /(?<![\\`])(`+)(?!`)(?:(?!\n[ \t>]*\n)[\s\S])+?(?<!`)\1(?!`)/g;

const CODE_SET_ASIDE = /\u0000(\d+)\u0000/g;

const NAMED_ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

/**
 * Code shows what was typed, a component's tag or a link included, so it is
 * set aside while the text around it is rewritten.
 */
function outsideCode(body: string, rewrite: (text: string) => string): string {
  const code: string[] = [];
  const setAside = (match: string) => `\u0000${code.push(match) - 1}\u0000`;
  const putBack = (text: string): string =>
    text.replace(CODE_SET_ASIDE, (placeholder, index: string) => (index in code ? putBack(code[Number(index)]) : placeholder));

  return putBack(rewrite(body.replace(FENCED_CODE, setAside).replace(INLINE_CODE, setAside)));
}

function attribute(tag: string, name: string): string | undefined {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

  return value === undefined ? undefined : decodeEntities(value);
}

/** In one pass, so that what an entity stands for is not read as an entity in turn. */
function decodeEntities(text: string): string {
  return text.replace(/&(#\d+|#[xX][0-9a-fA-F]+|quot|amp|lt|gt|apos);/g, (entity, name: string) => {
    if (!name.startsWith('#')) return NAMED_ENTITIES[name];

    const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    const isCharacter = code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff);

    return isCharacter ? String.fromCodePoint(code) : entity;
  });
}

/** Without an address there is nothing to link to, and the text stands alone. */
function link(text: string, url: string | undefined): string {
  return url ? `[${text.replace(/([[\]])/g, '\\$1')}](${url})` : text;
}

/**
 * A single space in front of a component is a stray. More than that places
 * the component in a list, and what replaces it stays there.
 */
function nestingOf(indent = ''): string {
  return indent.length > 1 ? indent : '';
}

/**
 * What replaces a component stands apart from what surrounds it: tweets that
 * follow one another would otherwise run together into one quotation. A
 * caption follows as a paragraph of its own, as the captions of images do.
 */
function block(markdown: string, tag: string, indent?: string, title?: string): string {
  const caption = attribute(tag, 'caption');
  const paragraphs = caption && caption !== title ? [markdown, caption] : [markdown];

  return `\n\n${paragraphs.map((paragraph) => paragraph.replace(/^(?=.)/gm, nestingOf(indent))).join('\n\n')}\n\n`;
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** `<YouTube>` and `<Vimeo>` become a link to the video. */
function rewriteVideos(body: string): string {
  const addresses = { YouTube: 'https://www.youtube.com/watch?v=', Vimeo: 'https://vimeo.com/' };

  return body.replace(
    new RegExp(`${INDENT}<(YouTube|Vimeo)\\b${ATTRIBUTES}/>`, 'gm'),
    (_, indent: string | undefined, name: keyof typeof addresses, tag: string) => {
      const id = attribute(tag, 'id');
      const title = attribute(tag, 'title') ?? 'Video';

      return block(link(title, id && `${addresses[name]}${id}`), tag, indent, title);
    },
  );
}

/** `<WpEmbed>` becomes a link to the page it previews. */
function rewriteEmbeds(body: string): string {
  return body.replace(new RegExp(`${INDENT}<WpEmbed\\b${ATTRIBUTES}/>`, 'gm'), (_, indent: string | undefined, tag: string) => {
    const url = attribute(tag, 'url');
    const title = attribute(tag, 'title') ?? url ?? '';

    return block(link(title, url), tag, indent, title);
  });
}

/** `<XTweet>` becomes a quotation, signed by its author with a link to the tweet. */
function rewriteTweets(body: string): string {
  return body.replace(
    new RegExp(`${INDENT}<XTweet\\b${ATTRIBUTES}>([\\s\\S]*?)</XTweet>`, 'gm'),
    (_, indent: string | undefined, tag: string, text: string) => {
      const id = attribute(tag, 'id');
      const url = attribute(tag, 'url') ?? (id && `https://twitter.com/i/web/status/${id}`);
      const author = tweetAuthor(attribute(tag, 'authorName'), attribute(tag, 'authorHandle'));
      const signature = [author, link(attribute(tag, 'date') ?? 'Tweet', url)].filter(Boolean).join(', ');
      // The tweet's own lines stand as deep as its tag.
      const lines = text.replace(new RegExp(`^[ \\t]{0,${nestingOf(indent).length}}`, 'gm'), '').trim();

      return block(quote(`${lines}\n\n— ${signature}`), tag, indent);
    },
  );
}

function absolute(path: string, site: URL): string {
  try {
    return new URL(path, site).href;
  } catch {
    return path;
  }
}

/** Links within the site are written from the root; outside the site they need its address. */
function absoluteLinks(body: string, site: URL): string {
  return body
    .replace(/\]\((\/[^)\s]*)/g, (_, path: string) => `](${absolute(path, site)}`)
    .replace(/\b(href|src)="(\/[^"]*)"/g, (_, name: string, path: string) => `${name}="${absolute(path, site)}"`);
}

function byline(post: MarkdownPost): string {
  const date = post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const published = post.author ? `Published ${date} by ${post.author}.` : `Published ${date}.`;

  return post.source ? `${published} Original article: ${post.source}` : published;
}

export function toPlainMarkdown(post: MarkdownPost, site: URL): string {
  const body = outsideCode(post.body, (text) =>
    absoluteLinks(rewriteTweets(rewriteEmbeds(rewriteVideos(text))), site)
      // Only on lines that are otherwise empty: two spaces behind text are a line break.
      .replace(/^[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n'),
  ).trim();

  return `# ${post.title}\n\n${byline(post)}\n\n${body}\n`;
}

/**
 * The components that were not rewritten and stand in the Markdown as they
 * were typed: those that `toPlainMarkdown` does not know, or not in this form.
 */
export function componentsLeft(markdown: string): string[] {
  const names = new Set<string>();

  outsideCode(markdown, (text) => {
    // Components are capitalised; plain HTML such as <figure> is not.
    for (const [, name] of text.matchAll(/<\/?([A-Z][A-Za-z0-9]*)/g)) names.add(name);

    return text;
  });

  return [...names];
}

/** Where a page's Markdown is served: its own address with `.md` appended. */
export function markdownPathFor(pagePath: string): string {
  return `${pagePath.replace(/\/$/, '')}.md`;
}
