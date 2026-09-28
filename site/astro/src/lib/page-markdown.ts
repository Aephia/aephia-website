/**
 * A post as plain Markdown: what "Copy" puts on the clipboard and what is
 * served at the post's address with `.md` appended.
 *
 * The posts are written in MDX. Their embed components mean nothing outside
 * this site, so each is rewritten as the Markdown that says the same thing,
 * and links are made absolute so that they still lead somewhere once the text
 * has been pasted elsewhere.
 */
export interface MarkdownPost {
  title: string;
  date: Date;
  author?: string;
  /** Where the post was first published, when that is not this site. */
  source?: string;
  /** The post's MDX body, without its frontmatter. */
  body: string;
}

/** The attributes of a component's tag. Quoted, so that a `>` in a value does not end the tag. */
const ATTRIBUTES = '((?:\\s+[\\w-]+="[^"]*")*)\\s*';

const NAMED_ENTITIES: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" };

function attribute(tag: string, name: string): string | undefined {
  const value = new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

  return value === undefined ? undefined : decodeEntities(value);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(quot|amp|lt|gt|apos);/g, (_, name: string) => NAMED_ENTITIES[name]);
}

function link(text: string, url: string): string {
  return `[${text.replace(/([[\]])/g, '\\$1')}](${url})`;
}

/**
 * What replaces a component stands apart from what surrounds it: tweets that
 * follow one another would otherwise run together into one quotation. A
 * caption follows as a paragraph of its own, as the captions of images do.
 */
function block(markdown: string, tag: string, title?: string): string {
  const caption = attribute(tag, 'caption');

  return caption && caption !== title ? `\n\n${markdown}\n\n${caption}\n\n` : `\n\n${markdown}\n\n`;
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

  return body.replace(new RegExp(`<(YouTube|Vimeo)\\b${ATTRIBUTES}/>`, 'g'), (_, name: keyof typeof addresses, tag: string) => {
    const title = attribute(tag, 'title') ?? 'Video';

    return block(link(title, `${addresses[name]}${attribute(tag, 'id')}`), tag, title);
  });
}

/** `<WpEmbed>` becomes a link to the page it previews. */
function rewriteEmbeds(body: string): string {
  return body.replace(new RegExp(`<WpEmbed\\b${ATTRIBUTES}/>`, 'g'), (_, tag: string) => {
    const url = attribute(tag, 'url') ?? '';
    const title = attribute(tag, 'title') ?? url;

    return block(link(title, url), tag, title);
  });
}

/** `<XTweet>` becomes a quotation, signed by its author with a link to the tweet. */
function rewriteTweets(body: string): string {
  return body.replace(new RegExp(`<XTweet\\b${ATTRIBUTES}>([\\s\\S]*?)</XTweet>`, 'g'), (_, tag: string, text: string) => {
    const url = attribute(tag, 'url') ?? `https://twitter.com/i/web/status/${attribute(tag, 'id')}`;
    const name = attribute(tag, 'authorName');
    const handle = attribute(tag, 'authorHandle')?.replace(/^@/, '');
    const author = [name, handle && `(@${handle})`].filter(Boolean).join(' ');
    const signature = [author, link(attribute(tag, 'date') ?? 'Tweet', url)].filter(Boolean).join(', ');

    return block(quote(`${text.trim()}\n\n— ${signature}`), tag);
  });
}

/** Links within the site are written from the root; outside the site they need its address. */
function absoluteLinks(body: string, site: URL): string {
  return body.replace(/\]\((\/[^)\s]*)\)/g, (_, path: string) => `](${new URL(path, site).href})`);
}

function byline(post: MarkdownPost): string {
  const date = post.date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const published = post.author ? `Published ${date} by ${post.author}.` : `Published ${date}.`;

  return post.source ? `${published} Original article: ${post.source}` : published;
}

/**
 * The components stand on lines of their own, often behind a stray space that
 * would end up in front of what replaces them.
 */
function unindentComponents(body: string): string {
  return body.replace(/^[ \t]+(?=<\/?[A-Z])/gm, '');
}

export function toPlainMarkdown(post: MarkdownPost, site: URL): string {
  const body = absoluteLinks(rewriteTweets(rewriteEmbeds(rewriteVideos(unindentComponents(post.body)))), site)
    // Only on lines that are otherwise empty: two spaces behind text are a line break.
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return `# ${post.title}\n\n${byline(post)}\n\n${body}\n`;
}

/** Where a page's Markdown is served: its own address with `.md` appended. */
export function markdownPathFor(pagePath: string): string {
  return `${pagePath.replace(/\/$/, '')}.md`;
}
