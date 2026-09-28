import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { markdownPathFor, toPlainMarkdown } from './page-markdown.ts';

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

  it('keeps tweets that follow one another apart', () => {
    const tweet = (id: string) => `<XTweet id="${id}" url="https://twitter.com/a/status/${id}" authorName="A" authorHandle="@a" date="2025-09-09">\nText ${id}.\n</XTweet>`;
    const markdown = post(`${tweet('1')}\n ${tweet('2')}`);

    assert.ok(markdown.includes('> Text 1.\n>\n> — A (@a), [2025-09-09](https://twitter.com/a/status/1)\n\n> Text 2.'));
  });

  it('reads the characters that a tag had to write as entities', () => {
    const markdown = post('<XTweet id="1" url="https://twitter.com/a/status/1" authorName="&#39;Stache &amp; Co" authorHandle="@CryptoStache" date="2023-02-01">\nText.\n</XTweet>');

    assert.ok(markdown.includes("— 'Stache & Co (@CryptoStache)"));
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

  it('leaves the text itself as it was written, line breaks included', () => {
    const body = 'A faction would need to:  \nmine &amp; refine, then A -&gt; B.\n\nSee [the roadmap](https://staratlas.com/roadmap).';

    assert.ok(post(body).includes(body));
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

  it('leave no component tag behind', () => {
    const left = files.filter((file) => {
      const body = readFileSync(file, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');

      // Components are capitalised; plain HTML such as <figure> is not.
      return /<\/?[A-Z]/.test(toPlainMarkdown({ title: 'Title', date: DATE, body }, SITE));
    });

    assert.deepEqual(left, []);
  });
});
