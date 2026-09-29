import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { componentsLeft, markdownPathFor, toPlainMarkdown } from './page-markdown.ts';

const SITE = new URL('https://intel.aephia.com');
const DATE = new Date(2026, 6, 18, 14, 7, 47);

const post = (body: string) => toPlainMarkdown({ title: 'Five Years', date: DATE, author: 'Funcracker', body }, SITE);

describe('toPlainMarkdown', () => {
  it('opens with the title, and when the post was published and by whom', () => {
    assert.equal(post('First paragraph.'), '# Five Years\n\nPublished July 18, 2026 by Funcracker.\n\nFirst paragraph.\n');
  });

  it('leaves out an author that is not known', () => {
    const markdown = toPlainMarkdown({ title: 'Five Years', date: DATE, body: 'Text.' }, SITE);

    assert.equal(markdown, '# Five Years\n\nPublished July 18, 2026.\n\nText.\n');
  });

  it('says where an archived article was first published', () => {
    const source = 'https://medium.com/star-atlas/a-dawn-for-a-dao-b001d8ce6be5';
    const markdown = toPlainMarkdown({ title: 'A Dawn', date: DATE, author: 'Star Atlas', source, body: 'Text.' }, SITE);

    assert.match(markdown, /^# A Dawn\n\nPublished July 18, 2026 by Star Atlas\. Original article: https:\/\/medium\.com\/star-atlas\/a-dawn-for-a-dao-b001d8ce6be5\n\nText\.\n$/);
  });

  it('turns a YouTube video into a link to it', () => {
    const markdown = post('Before.\n\n<YouTube id="gEKH5JKkwnY" title="COPA #2 [2024] – Where we won"  />\n\nAfter.');

    assert.ok(markdown.includes('Before.\n\n[COPA #2 \\[2024\\] – Where we won](https://www.youtube.com/watch?v=gEKH5JKkwnY)\n\nAfter.'));
  });

  it('turns a Vimeo video into a link to it', () => {
    const markdown = post('<Vimeo id="1014815013" title="Star Atlas adjustable seat"  />');

    assert.ok(markdown.includes('[Star Atlas adjustable seat](https://vimeo.com/1014815013)'));
  });

  it('puts a caption under the video, unless it only repeats the title', () => {
    const captioned = post('<YouTube id="abc" title="Star Atlas Company Update" caption="Want to see the whole thing again?" />');
    const repeated = post('<Vimeo id="723903316" title="Alpha Part 1" caption="Alpha Part 1" />');

    assert.ok(captioned.includes('[Star Atlas Company Update](https://www.youtube.com/watch?v=abc)\n\nWant to see the whole thing again?\n'));
    assert.ok(repeated.endsWith('\n\n[Alpha Part 1](https://vimeo.com/723903316)\n'));
  });

  it('puts a caption under an embedded page and under a tweet as well', () => {
    const embed = post('<WpEmbed url="https://aephia.com/quimera/" title="Aephia partners with Quimera" siteTitle="Aephia Industries" caption="Read our partnership announcement" />');
    const tweet = post('<XTweet id="1" url="https://twitter.com/staratlas/status/1" authorName="Star Atlas" authorHandle="@staratlas" date="2023-05-26" caption="Pearce X6 Presentation">\nText.\n</XTweet>');

    assert.ok(embed.endsWith('\n\n[Aephia partners with Quimera](https://aephia.com/quimera/)\n\nRead our partnership announcement\n'));
    assert.ok(tweet.endsWith('\n> — Star Atlas (@staratlas), [2023-05-26](https://twitter.com/staratlas/status/1)\n\nPearce X6 Presentation\n'));
  });

  it('turns an embedded page into a link to it', () => {
    const markdown = post('<WpEmbed url="https://aephia.com/copa-presentations/" title="COPA PRESENTATIONS" siteTitle="Aephia Industries"  />');

    assert.ok(markdown.includes('[COPA PRESENTATIONS](https://aephia.com/copa-presentations/)'));
    assert.ok(!markdown.includes('siteTitle'));
  });

  it('turns a tweet into a quotation, signed by its author with a link to the tweet', () => {
    const markdown = post(
      ' <XTweet id="1965519923461099803" url="https://twitter.com/Chypto_/status/1965519923461099803" authorName="Chypto" authorHandle="@Chypto_" date="2025-09-09">\n' +
        'Dev Log 35: Busy meeting day.\n\nInternally testing a change. [pic.twitter.com/Tpw4Ec8fGS](https://t.co/Tpw4Ec8fGS)\n' +
        '</XTweet>\n ',
    );

    assert.ok(
      markdown.endsWith(
        '\n\n> Dev Log 35: Busy meeting day.\n>\n> Internally testing a change. [pic.twitter.com/Tpw4Ec8fGS](https://t.co/Tpw4Ec8fGS)\n>\n' +
          '> — Chypto (@Chypto_), [2025-09-09](https://twitter.com/Chypto_/status/1965519923461099803)\n',
      ),
    );
  });

  it('finds the tweet by its id when its address is not given', () => {
    const markdown = post('<XTweet id="1965519923461099803" authorName="Chypto" authorHandle="Chypto_" date="2025-09-09">\nText.\n</XTweet>');

    assert.ok(markdown.endsWith('> — Chypto (@Chypto_), [2025-09-09](https://twitter.com/i/web/status/1965519923461099803)\n'));
  });

  it('links to nothing when there is nothing to link to', () => {
    const video = post('<YouTube title="Company Update" />');
    const tweet = post('<XTweet authorName="Chypto" date="2025-09-09">\nText.\n</XTweet>');

    assert.ok(video.endsWith('\n\nCompany Update\n'));
    assert.ok(tweet.endsWith('\n> Text.\n>\n> — Chypto, 2025-09-09\n'));
    assert.ok(!video.includes('undefined') && !tweet.includes('undefined'));
  });

  it('keeps tweets that follow one another apart', () => {
    const tweet = (id: string) => `<XTweet id="${id}" url="https://twitter.com/a/status/${id}" authorName="A" authorHandle="@a" date="2025-09-09">\nText ${id}.\n</XTweet>`;
    const markdown = post(`${tweet('1')}\n ${tweet('2')}`);

    assert.ok(markdown.includes('> Text 1.\n>\n> — A (@a), [2025-09-09](https://twitter.com/a/status/1)\n\n> Text 2.'));
  });

  it('reads the characters that a tag had to write as entities', () => {
    const markdown = post('<XTweet id="1" url="https://twitter.com/a/status/1" authorName="&#39;Stache &amp; Co" authorHandle="@CryptoStache" date="2023-02-01">\nText.\n</XTweet>');

    assert.ok(markdown.includes("— 'Stache & Co (@CryptoStache)"));
  });

  it('leaves an entity that stands for no character as it was written', () => {
    const markdown = post('<YouTube id="abc" title="A &#99999999; B &#xD800; C &#0; D" />');

    assert.ok(markdown.includes('[A &#99999999; B &#xD800; C &#0; D](https://www.youtube.com/watch?v=abc)'));
  });

  it('does not read what an entity stands for as an entity in turn', () => {
    const markdown = post('<YouTube id="abc" title="Write &#38;lt; and &amp;quot; for these" />');

    assert.ok(markdown.includes('[Write &lt; and &quot; for these](https://www.youtube.com/watch?v=abc)'));
  });

  it('is not misled by a > in a title', () => {
    const markdown = post('<YouTube id="abc" title="Rock -> Rocket" />');

    assert.ok(markdown.includes('[Rock -> Rocket](https://www.youtube.com/watch?v=abc)'));
  });

  it('gives links within the site their full address', () => {
    const markdown = post('Read [the guide](/guides/sage-labs/#fleets) and see ![a map](/images/map.png).');

    assert.ok(markdown.includes('[the guide](https://intel.aephia.com/guides/sage-labs/#fleets)'));
    assert.ok(markdown.includes('![a map](https://intel.aephia.com/images/map.png)'));
  });

  it('gives them their full address when they carry a title, and in plain HTML', () => {
    const markdown = post('Read [the guide](/guides/sage-labs/ "SAGE Labs"), <a href="/news/">the news</a> and <img src="/images/map.png" alt="a map" />.');

    assert.ok(markdown.includes('[the guide](https://intel.aephia.com/guides/sage-labs/ "SAGE Labs")'));
    assert.ok(markdown.includes('<a href="https://intel.aephia.com/news/">the news</a>'));
    assert.ok(markdown.includes('<img src="https://intel.aephia.com/images/map.png" alt="a map" />'));
  });

  it('leaves a link that is no address as it was written', () => {
    const body = 'See [this](//[) and [that](/guides/).';

    assert.ok(post(body).includes('See [this](//[) and [that](https://intel.aephia.com/guides/).'));
  });

  it('leaves code as it was typed', () => {
    const fenced = '```jsx\n <YouTube id="abc" title="A video" />\n\n\n\nconst link = "[the guide](/guides/)";\n```';
    const quoted = '> ```\n> <Vimeo id="1" title="A video" />\n> ```';
    const inline = 'Embed a video with `<YouTube id="abc" title="A video" />` and link to `[the guide](/guides/)`.';

    assert.ok(post(fenced).endsWith(`\n\n${fenced}\n`));
    assert.ok(post(quoted).endsWith(`\n\n${quoted}\n`));
    assert.ok(post(inline).endsWith(`\n\n${inline}\n`));
  });

  it('still rewrites what stands around code', () => {
    const markdown = post('Type `/join`.\n\n<YouTube id="abc" title="A video" />\n\n```\n/verify\n```\n\nRead [the guide](/guides/).');

    assert.ok(
      markdown.endsWith('\n\nType `/join`.\n\n[A video](https://www.youtube.com/watch?v=abc)\n\n```\n/verify\n```\n\nRead [the guide](https://intel.aephia.com/guides/).\n'),
    );
  });

  it('is not misled by a backtick that opens no code', () => {
    const markdown = post('The 1990\\`s, or the `90s.\n\n<YouTube id="abc" title="A video" />\n\nIt`s over.');

    assert.ok(markdown.includes('\n\n[A video](https://www.youtube.com/watch?v=abc)\n\n'));
  });

  it('keeps a video, an embedded page and a tweet in the list they stand in', () => {
    const markdown = post(
      '1. Watch the video.\n\n   <YouTube id="abc" title="A video" caption="Its caption" />\n\n   Then read on.\n\n' +
        '2. Read the tweet.\n\n   <XTweet id="1" url="https://twitter.com/a/status/1" authorName="A" authorHandle="@a" date="2025-09-09">\n   One.\n\n   Two.\n   </XTweet>\n\n' +
        '- Read the page.\n\n  <WpEmbed url="https://aephia.com/copa/" title="COPA" />',
    );

    assert.ok(markdown.includes('1. Watch the video.\n\n   [A video](https://www.youtube.com/watch?v=abc)\n\n   Its caption\n\n   Then read on.\n\n'));
    assert.ok(markdown.includes('2. Read the tweet.\n\n   > One.\n   >\n   > Two.\n   >\n   > — A (@a), [2025-09-09](https://twitter.com/a/status/1)\n\n'));
    assert.ok(markdown.endsWith('- Read the page.\n\n  [COPA](https://aephia.com/copa/)\n'));
  });

  it('drops what stands on lines that are otherwise empty, and empty lines beyond the first', () => {
    const markdown = post('One.\n \t\n\n\n   \nTwo.  \nThree.');

    assert.ok(markdown.endsWith('\n\nOne.\n\nTwo.  \nThree.\n'));
  });

  it('leaves the text itself as it was written, line breaks included', () => {
    const body = 'A faction would need to:  \nmine &amp; refine, then A -&gt; B.\n\nSee [the roadmap](https://staratlas.com/roadmap).';

    assert.ok(post(body).includes(body));
  });
});

describe('componentsLeft', () => {
  it('names the components that were not rewritten', () => {
    const markdown = post("<Spotify id=\"1\" />\n\n<YouTube id='abc' />\n\n<Callout>\nMind this.\n</Callout>\n\n<Vimeo id=\"1\" title=\"A video\" />");

    assert.deepEqual(componentsLeft(markdown), ['Spotify', 'YouTube', 'Callout']);
  });

  it('does not take plain HTML or code for a component', () => {
    assert.deepEqual(componentsLeft('<figure class="wp-block-embed">A</figure> and `<YouTube id="abc" />`\n\n```\n<Vimeo id="1" />\n```'), []);
  });
});

describe('markdownPathFor', () => {
  it("appends .md to the page's address", () => {
    assert.equal(markdownPathFor('/news/five-years-of-aephia-industries/'), '/news/five-years-of-aephia-industries.md');
    assert.equal(markdownPathFor('/sa-medium/a-dawn-for-a-dao'), '/sa-medium/a-dawn-for-a-dao.md');
  });
});

describe('the posts of the site', () => {
  const collections = ['posts', 'sa-medium'].map((name) => join(import.meta.dirname, '../content', name));
  const files = collections.flatMap((root) =>
    readdirSync(root)
      .filter((file) => file.endsWith('.mdx'))
      .map((file) => join(root, file)),
  );

  it('are found', () => {
    assert.ok(files.length >= 600);
  });

  const markdownOf = (file: string) => {
    const body = readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

    return toPlainMarkdown({ title: 'Title', date: DATE, body }, SITE);
  };

  it('leave no component tag behind', () => {
    const left = files.flatMap((file) => componentsLeft(markdownOf(file)).map((name) => `${file}: <${name}>`));

    assert.deepEqual(left, []);
  });

  it('leave no link behind that leads nowhere', () => {
    const count = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length;
    // A link without an address may be the writer's own; rewriting must not add one.
    const nowhere = files.filter((file) =>
      [/\]\(\)/g, /\]\([^)]*undefined[^)]*\)/g].some((pattern) => count(markdownOf(file), pattern) > count(readFileSync(file, 'utf8'), pattern)),
    );

    assert.deepEqual(nowhere, []);
  });
});
