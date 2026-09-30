/**
 * A post as plain Markdown: what "Copy" puts on the clipboard and what is
 * served at the post's address with `.md` appended.
 *
 * The posts are written in MDX. Their embed components mean nothing outside
 * this site, so each is rewritten as the Markdown that says the same thing,
 * and links are made absolute so that they still lead somewhere once the text
 * has been pasted elsewhere.
 *
 * The posts are written by a pipeline and built without review, so what is
 * not understood here stays as it was written.
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

type Kind = 'text' | 'fenced' | 'tweet' | 'embed' | 'tag' | 'html' | 'code' | 'link';

/** A stretch of the text, and what it was read as. */
interface Part {
  kind: Kind;
  text: string;
  /** Where in the text it begins. */
  at: number;
  /** What was read within it, by name. */
  is: Record<string, string | undefined>;
}

/** The attributes of a component's tag. Quoted, so that a `>` in a value does not end the tag. */
const ATTRIBUTES = '(?:\\s+[\\w-]+="[^"]*")*\\s*';

const LIST_MARKER = '(?:[-*+]|\\d{1,9}[.)])';

/** What may open a line in front of a block: indentation, and the markers of quotations and lists. */
const CONTAINERS = `(?:[ \\t>]|${LIST_MARKER}(?=[ \\t]))*`;

/** What a tag holds behind its name. It does not reach across an empty line. */
const WITHIN_TAG = `(?:"[^"]*"|'[^']*'|\\{[^{}]*\\}|(?!\\n[ \\t]*\\n)[^<>"'{}])*`;

/**
 * What the text is read for, from left to right. What has been read is not
 * read again, so a tag inside code is code and a backtick inside a tag is part
 * of the tag. Where two of these begin at the same place, the first one named
 * is taken.
 */
const PARTS = new RegExp(
  [
    // The line that opens a block of code. Where the block ends is for `endOfCode` to say.
    `(?<fenced>^(?<container>${CONTAINERS})(?<fence>\`{3,}(?=[^\\n\`]*$)|~{3,})[^\\n]*$)`,
    // A tweet holds no other tweet, which also keeps a tag that is never closed from being read to the end time and again.
    `(?<tweet>(?<tweetIndent>^[ \\t]*)?<XTweet\\b(?<tweetTag>${ATTRIBUTES})>(?<tweetText>(?:(?!<XTweet\\b)[\\s\\S])*?)</XTweet>)`,
    `(?<embed>(?<embedIndent>^[ \\t]*)?<(?<embedName>YouTube|Vimeo|WpEmbed)\\b(?<embedTag>${ATTRIBUTES})/>)`,
    // The tag of any other component, or of one of the above in a form that is not rewritten.
    `(?<tag></?[A-Z][\\w.]*\\b${WITHIN_TAG}>)`,
    `(?<html><[a-z][a-z0-9-]*\\b${WITHIN_TAG}>)`,
    // Code within a line. It stays on its line, so that a stray backtick claims no more than that.
    `(?<code>(?<![\\\\\`])(?<ticks>\`+)(?!\`)[^\\n]+?(?<!\`)\\k<ticks>(?!\`))`,
    `(?<link>\\]\\()(?<linkPath>/[^)\\s]*)`,
  ].join('|'),
  'gm',
);

const KINDS: Kind[] = ['fenced', 'tweet', 'embed', 'tag', 'html', 'code', 'link'];

const LIST_ITEM = new RegExp(`^[ \\t]*${LIST_MARKER}(?:[ \\t]+|$)`);

/** How far back a list is looked for: no item of a list in a post is this long. */
const LOOK_BACK = { characters: 20_000, lines: 200 };

const NAMED_ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

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

/** Links within the site are written from the root; outside the site they need its address. */
function absolute(address: string, site: URL): string {
  if (!address.startsWith('/')) return address;

  try {
    return new URL(address, site).href;
  } catch {
    return address;
  }
}

/** Without an address there is nothing to link to, and the text stands alone. */
function link(text: string, address: string | undefined, site: URL): string {
  return address ? `[${text.replace(/([[\]])/g, '\\$1')}](${absolute(address, site)})` : text;
}

function width(indent: string): number {
  return indent.replaceAll('\t', '    ').length;
}

function indentOf(line: string): string {
  return /^[ \t]*/.exec(line)?.[0] ?? '';
}

/**
 * How far the text of an item of a list is indented, when what stands at `at`,
 * this far from the margin, belongs to that item. Empty when it belongs to none.
 *
 * It belongs to the nearest item above it whose text begins no further from
 * the margin than it stands itself, and than every paragraph in between
 * begins. Only where a paragraph begins counts: it goes on wherever its next
 * line starts.
 *
 * What does not stand in a list starts its line, however far it was indented:
 * the posts have a stray space in front of their components, and four spaces
 * would turn what replaces one into a block of code.
 */
function nesting(body: string, at: number, indent = ''): string {
  if (indent === '') return '';

  const above = body.slice(Math.max(0, at - LOOK_BACK.characters), at).split('\n').slice(-LOOK_BACK.lines - 1, -1);
  let depth = width(indent);
  // How far the paragraph that is being passed begins from the margin, as far as it has been passed.
  let begins: number | undefined;

  for (const line of above.reverse()) {
    if (line.trim() === '') {
      depth = Math.min(depth, begins ?? depth);
      begins = undefined;
      if (depth === 0) return '';
      continue;
    }

    const item = LIST_ITEM.exec(line)?.[0];
    const text = item === undefined ? undefined : (/\s$/.test(item) ? item : `${item} `).replace(/\S/g, ' ');
    if (text !== undefined && width(text) <= depth) return text;

    begins = width(indentOf(line));
  }

  return '';
}

/**
 * Where the block of code ends that this line opens: behind the fence that
 * closes it, or with the quotation or the item of a list that it stands in,
 * or else with the text.
 */
function endOfCode(body: string, opening: Part): number {
  const { container = '', fence = '' } = opening.is;
  const quoted = container.includes('>');
  // In a quotation it is the quotation that ends the block, whatever list that stands in.
  const item = quoted || new RegExp(LIST_MARKER).test(container) ? container : nesting(body, opening.at, container);
  const closes = new RegExp(`^[ \\t${quoted ? '>' : ''}]*${fence[0]}{${fence.length},}[ \\t]*$`);

  let end = opening.at + opening.text.length;
  // Behind the last line that holds anything: the empty lines that follow it belong to what comes next.
  let held = end;

  while (end < body.length) {
    const next = body.indexOf('\n', end + 1);
    const line = body.slice(end + 1, next === -1 ? body.length : next);
    const empty = line.trim() === '';

    if (quoted ? !/^[ \t]*>/.test(line) : !empty && width(indentOf(line)) < width(item)) return held;

    end = next === -1 ? body.length : next;
    if (closes.test(line)) return end;
    if (!empty) held = end;
  }

  return end;
}

/** The text in its parts. */
function read(body: string): Part[] {
  const parts: Part[] = [];
  // With a place in the text of its own: a tweet is read while the text around it is.
  const reader = new RegExp(PARTS);
  let at = 0;

  for (let found = reader.exec(body); found; found = reader.exec(body)) {
    const is = found.groups ?? {};
    const part: Part = { kind: KINDS.find((kind) => is[kind] !== undefined) ?? 'text', text: found[0], at: found.index, is };
    if (part.kind === 'fenced') part.text = body.slice(part.at, endOfCode(body, part));

    parts.push({ kind: 'text', text: body.slice(at, part.at), at, is: {} }, part);
    at = reader.lastIndex = part.at + part.text.length;
  }

  return [...parts, { kind: 'text', text: body.slice(at), at, is: {} }];
}

/**
 * What replaces a component stands apart from what surrounds it: tweets that
 * follow one another would otherwise run together into one quotation. A
 * caption follows as a paragraph of its own, as the captions of images do.
 */
function block(markdown: string, tag: string, indent: string, title?: string): string {
  const caption = attribute(tag, 'caption');
  const paragraphs = caption && caption !== title ? [markdown, caption] : [markdown];

  return `\n\n${paragraphs.map((paragraph) => paragraph.replace(/^(?=.)/gm, indent)).join('\n\n')}\n\n`;
}

function quote(text: string): string {
  return text
    .split('\n')
    .map((line) => (line.trim() === '' ? '>' : `> ${line}`))
    .join('\n');
}

/** `<YouTube>` and `<Vimeo>` become a link to the video, `<WpEmbed>` one to the page it previews. */
function embed(name: string, tag: string, indent: string, site: URL): string {
  const videos: Record<string, string> = { YouTube: 'https://www.youtube.com/watch?v=', Vimeo: 'https://vimeo.com/' };
  const id = attribute(tag, 'id');
  const address = name in videos ? id && `${videos[name]}${id}` : attribute(tag, 'url');
  const title = attribute(tag, 'title') ?? (name in videos ? 'Video' : (address ?? ''));

  return block(link(title, address, site), tag, indent, title);
}

/** `<XTweet>` becomes a quotation, signed by its author with a link to the tweet. */
function tweet(tag: string, text: string, typed: string, indent: string, site: URL): string {
  const id = attribute(tag, 'id');
  const address = attribute(tag, 'url') ?? (id && `https://twitter.com/i/web/status/${id}`);
  const author = tweetAuthor(attribute(tag, 'authorName'), attribute(tag, 'authorHandle'));
  const signature = [author, link(attribute(tag, 'date') ?? 'Tweet', address, site)].filter(Boolean).join(', ');
  // The tweet's own lines stand as deep as its tag was typed.
  const lines = text.replace(new RegExp(`^[ \\t]{0,${typed.length}}`, 'gm'), '');

  return block(quote(`${tidy(read(lines), lines, site)}\n\n— ${signature}`), tag, indent);
}

function rewritten(part: Part, body: string, site: URL): string {
  const { is } = part;
  const indent = () => nesting(body, part.at, is.tweetIndent ?? is.embedIndent);

  switch (part.kind) {
    case 'tweet':
      return tweet(is.tweetTag ?? '', is.tweetText ?? '', is.tweetIndent ?? '', indent(), site);
    case 'embed':
      return embed(is.embedName ?? '', is.embedTag ?? '', indent(), site);
    case 'link':
      return `${is.link}${absolute(is.linkPath ?? '', site)}`;
    case 'html':
      return part.text.replace(/(\s(?:href|src)=")(\/[^"]*)/g, (_, name: string, path: string) => `${name}${absolute(path, site)}`);
    default:
      return part.text;
  }
}

/** Blocks of code are left as they are. What stands between them loses what no reader would miss. */
function tidy(parts: Part[], body: string, site: URL): string {
  let markdown = '';
  let between = '';

  const close = () => {
    markdown += between
      // Only on lines that are otherwise empty: two spaces behind text are a line break.
      .replace(/^[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n');
    between = '';
  };

  for (const part of parts) {
    if (part.kind !== 'fenced') {
      between += rewritten(part, body, site);
      continue;
    }

    close();
    markdown += part.text;
  }
  close();

  return markdown.trim();
}

function byline(post: MarkdownPost): string {
  const date = post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const published = post.author ? `Published ${date} by ${post.author}.` : `Published ${date}.`;

  return post.source ? `${published} Original article: ${post.source}` : published;
}

function headed(post: MarkdownPost, body: string): string {
  return `# ${post.title}\n\n${byline(post)}\n\n${body}\n`;
}

export function toPlainMarkdown(post: MarkdownPost, site: URL): string {
  return headed(post, tidy(read(post.body), post.body, site));
}

/** The post with its components as they were typed: what is served when it cannot be rewritten. */
export function asTyped(post: MarkdownPost): string {
  return headed(post, post.body.trim());
}

/**
 * The components that were not rewritten and stand in the Markdown as they
 * were typed: those that `toPlainMarkdown` does not know, or not in this form.
 */
export function componentsLeft(markdown: string): string[] {
  const names = new Set<string>();

  for (const part of read(markdown)) {
    if (part.kind === 'fenced' || part.kind === 'code') continue;

    // Components are capitalised; plain HTML such as <figure> is not.
    for (const [, name] of part.text.matchAll(/<\/?([A-Z][A-Za-z0-9]*)/g)) names.add(name);
  }

  return [...names];
}

/** Where a page's Markdown is served: its own address with `.md` appended. */
export function markdownPathFor(pagePath: string): string {
  return `${pagePath.replace(/\/$/, '')}.md`;
}
