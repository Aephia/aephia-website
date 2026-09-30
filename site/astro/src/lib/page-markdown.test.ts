import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { asTyped, componentsLeft, markdownPathFor, toPlainMarkdown } from './page-markdown.ts';

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

  it('gives a page that is embedded from this site its full address', () => {
    const markdown = post('<WpEmbed url="/guides/sage-labs/" title="SAGE Labs" />');

    assert.ok(markdown.endsWith('\n\n[SAGE Labs](https://intel.aephia.com/guides/sage-labs/)\n'));
  });

  it('leaves the address of a page on another site as it was written, and names the page by it', () => {
    const markdown = post('<WpEmbed url="https://aephia.com/copa presentations/?a=b&amp;c" />');

    assert.ok(markdown.endsWith('\n\n[https://aephia.com/copa presentations/?a=b&c](https://aephia.com/copa presentations/?a=b&c)\n'));
  });

  it('gives every link in a tag of plain HTML its full address, whatever else the tag holds', () => {
    const markdown = post(
      '<figure class="x"><img src="/img/a.png" alt="it`s" /><a title="a > b" href="/p/">t</a></figure> that`s [l](/x)\n\n' +
        '<img src="/c.png"\n  srcset="/c.png 1x"\n  data-src="/d.png"> and <a href="https://aephia.com/">elsewhere</a> and <a src="/e" href="/f">both</a>',
    );

    assert.ok(
      markdown.endsWith(
        '\n\n<figure class="x"><img src="https://intel.aephia.com/img/a.png" alt="it`s" /><a title="a > b" href="https://intel.aephia.com/p/">t</a></figure> that`s [l](https://intel.aephia.com/x)\n\n' +
          '<img src="https://intel.aephia.com/c.png"\n  srcset="/c.png 1x"\n  data-src="/d.png"> and <a href="https://aephia.com/">elsewhere</a> and <a src="https://intel.aephia.com/e" href="https://intel.aephia.com/f">both</a>\n',
      ),
    );
  });

  describe('leaves code as it was typed', () => {
    const unchanged = (body: string) => assert.equal(post(body), `# Five Years\n\nPublished July 18, 2026 by Funcracker.\n\n${body}\n`);

    it('between fences, empty lines included', () => {
      unchanged('```jsx\n <YouTube id="abc" title="A video" />\n\n\n\nconst link = "[the guide](/guides/)";\n   \n```');
    });

    it('between fences of tildes', () => {
      unchanged('~~~\n<YouTube id="abc" title="A video" />\n\n\n\n[the guide](/guides/)\n~~~');
    });

    it('between fences in a quotation', () => {
      unchanged('> ```\n> <Vimeo id="1" title="A video" />\n>\n>\n>\n> [the guide](/guides/)\n> ```');
    });

    it('between fences that open an item of a list', () => {
      unchanged('- ```js\n  <Vimeo id="1" title="A video" />\n\n\n\n  [the guide](/guides/)\n  ```\n\n1. ```\n   <Vimeo id="2" title="A video" />\n   ```');
    });

    it('up to a fence that is as long as the one that opened the block', () => {
      unchanged('````\n```\n<YouTube id="abc" title="A video" />\n\n\n\n```\n[the guide](/guides/)\n````');
    });

    it('to the end of the text when its fence is not closed', () => {
      unchanged('Before.\n\n```\n<YouTube id="abc" title="A video" />\n\n\n\n[the guide](/guides/)');
    });

    it('up to a fence that stands where the block does, not one in a quotation', () => {
      unchanged('```js\n> ```\n<img src="/s.png">\n\n\n\n[the guide](/guides/)\n```');
    });

    it('behind a fence of tildes that names its language with a backtick', () => {
      unchanged('~~~ a`b\n<Vimeo id="1" title="A video" />\n\n\n\n[the guide](/guides/)\n~~~');
    });

    it('between backticks within a line, however many, that hold others', () => {
      unchanged('Type `` [a`b](/x) `` and `[a``b](/x)` and ```<Vimeo id="1" />```.');
    });

    it('within a line', () => {
      unchanged('Embed a video with `<YouTube id="abc" title="A video" />` and link to ``[the `guide`](/guides/)``.');
    });

    it('when it looks like something this code could have written', () => {
      unchanged('Run `\u00000\u0000` and \u00000\u0000 now.\n\n```\n\u00001\u0000\n```');
    });
  });

  it('ends a block of code that is not closed where its quotation or its item ends', () => {
    const quoted = post('> ```\n> /shot\n\n\n\n<Vimeo id="1" title="After" />');
    const item = post('- ```js\n  const a = 1;\n\n\n\nRead [the guide](/guides/).\n\n1. Step\n\n   ```\n   /join\n\n\n\n<Vimeo id="2" title="After" />');

    assert.ok(quoted.endsWith('\n\n> ```\n> /shot\n\n[After](https://vimeo.com/1)\n'));
    assert.ok(item.endsWith('\n\n- ```js\n  const a = 1;\n\nRead [the guide](https://intel.aephia.com/guides/).\n\n1. Step\n\n   ```\n   /join\n\n[After](https://vimeo.com/2)\n'));
  });

  it('takes for no fence what is none', () => {
    const video = '<Vimeo id="1" title="A video" />';
    const replaced = '[A video](https://vimeo.com/1)';

    for (const none of ['``', '```<YouTube id="abc" />``` is how to embed one.']) {
      assert.ok(post(`${none}\n\n${video}`).endsWith(`\n\n${none}\n\n${replaced}\n`), none);
    }

    // A marker of a list has a space behind it.
    assert.ok(post(`-\`\`\`\n  ${video}\n  \`\`\``).endsWith(`\n\n-\`\`\`\n\n${replaced}\n\n  \`\`\`\n`));
  });

  it('ends a block of code at a fence that is longer, or has spaces behind it', () => {
    const markdown = post('```\n/join\n`````  \n\n<Vimeo id="1" title="A video" />\n\n~~~~\n/shot\n~~~~~\t\n\nRead [the guide](/guides/).');

    assert.ok(markdown.endsWith('\n\n```\n/join\n`````  \n\n[A video](https://vimeo.com/1)\n\n~~~~\n/shot\n~~~~~\t\n\nRead [the guide](https://intel.aephia.com/guides/).\n'));
  });

  it('still rewrites what stands around code', () => {
    const markdown = post(
      'Type `/join`.\n\n<YouTube id="abc" title="A video" />\n\n```\n/verify\n```\n\nRead [the guide](/guides/).\n\n- ```js\n  const a = 1;\n  ```\n\n<Vimeo id="1" title="After" />\n\n' +
        '> ~~~\n> /shot\n> ~~~\n>\n> Read [the news](/news/).',
    );

    assert.ok(
      markdown.endsWith(
        '\n\nType `/join`.\n\n[A video](https://www.youtube.com/watch?v=abc)\n\n```\n/verify\n```\n\nRead [the guide](https://intel.aephia.com/guides/).\n\n' +
          '- ```js\n  const a = 1;\n  ```\n\n[After](https://vimeo.com/1)\n\n' +
          '> ~~~\n> /shot\n> ~~~\n>\n> Read [the news](https://intel.aephia.com/news/).\n',
      ),
    );
  });

  it('does not take a backtick that is escaped for the start of code', () => {
    const markdown = post('The 1990\\`s saw [the guide](/guides/) and the \\`90s.');

    assert.ok(markdown.endsWith('\n\nThe 1990\\`s saw [the guide](https://intel.aephia.com/guides/) and the \\`90s.\n'));
  });

  it('does not let a stray backtick reach beyond its line', () => {
    const paragraph = post('It`s a nice day.\n<YouTube id="abc" title="A video" />\nThat`s it.');
    const list = post('- It`s one\n- [two](/two)\n- That`s three');

    assert.ok(paragraph.endsWith('\n\nIt`s a nice day.\n\n[A video](https://www.youtube.com/watch?v=abc)\n\nThat`s it.\n'));
    assert.ok(list.endsWith('\n\n- It`s one\n- [two](https://intel.aephia.com/two)\n- That`s three\n'));
  });

  it('reads a backtick in a tag as part of the tag', () => {
    const video = post('<YouTube id="abc" title="Don`t miss this" caption="Don`t miss this" />');
    const tweet = post('<XTweet id="1" authorName="Dan`s" date="2025-09-09">\nDon`t miss it\n</XTweet>');

    assert.ok(video.endsWith('\n\n[Don`t miss this](https://www.youtube.com/watch?v=abc)\n'));
    assert.ok(tweet.endsWith('\n\n> Don`t miss it\n>\n> — Dan`s, [2025-09-09](https://twitter.com/i/web/status/1)\n'));

    for (const tag of ['<Badge label="It`s new" />', "<Badge label='It`s new' />", '<Badge label={"It`s new"} />', '<Badge\n  label="It`s new"\n/>', '<Badge>It is new</Badge\n  data-is="`">']) {
      assert.ok(post(`${tag} See [the guide](/guides/), that\`s all.`).endsWith(`\n\n${tag} See [the guide](https://intel.aephia.com/guides/), that\`s all.\n`), tag);
    }
  });

  it('does not take for a tag what reaches across an empty line', () => {
    const markdown = post('Is A <B here?\n\nRead [the guide](/guides/) when x > y, or a <b there?\n\nRead [the news](/news/) when x > y.');

    assert.ok(
      markdown.endsWith('\n\nIs A <B here?\n\nRead [the guide](https://intel.aephia.com/guides/) when x > y, or a <b there?\n\nRead [the news](https://intel.aephia.com/news/) when x > y.\n'),
    );
  });

  it('does not take a tweet that is not closed for the start of the next', () => {
    const markdown = post('<XTweet id="1" authorName="A">\nOne.\n\n<XTweet id="2" authorName="B">\nTwo.\n</XTweet>');

    assert.ok(markdown.endsWith('\n\n<XTweet id="1" authorName="A">\nOne.\n\n> Two.\n>\n> — B, [Tweet](https://twitter.com/i/web/status/2)\n'));
    assert.deepEqual(componentsLeft(markdown), ['XTweet']);
  });

  it('quotes every line of the code in a tweet', () => {
    const markdown = post('<XTweet id="1" authorName="A" date="2025-09-09">\nLook:\n```js\nconst a = "[x](/y)";\n```\nSee [the guide](/guides/).\n</XTweet>');

    assert.ok(
      markdown.endsWith(
        '\n\n> Look:\n> ```js\n> const a = "[x](/y)";\n> ```\n> See [the guide](https://intel.aephia.com/guides/).\n>\n> — A, [2025-09-09](https://twitter.com/i/web/status/1)\n',
      ),
    );
  });

  it('keeps the code in the address of a link', () => {
    assert.ok(post('[a](/docs/`x`) and `b`').endsWith('\n\n[a](https://intel.aephia.com/docs/%60x%60) and `b`\n'));
  });

  it('keeps a video, an embedded page and a tweet in the list they stand in', () => {
    const markdown = post(
      '1. Watch the video.\n\n   <YouTube id="abc" title="A video" caption="Its caption" />\n\n   Then read on.\n\n' +
        '2. Read the tweet.\n\n   <XTweet id="1" url="https://twitter.com/a/status/1" authorName="A" authorHandle="@a" date="2025-09-09">\n   One.\n\n   Two.\n   </XTweet>\n\n' +
        '- Read the page.\n\n  <WpEmbed url="https://aephia.com/copa/" title="COPA" />\n\n' +
        '- Watch the other video.\n\n\t<Vimeo id="1" title="Another video" />',
    );

    assert.ok(markdown.includes('1. Watch the video.\n\n   [A video](https://www.youtube.com/watch?v=abc)\n\n   Its caption\n\n   Then read on.\n\n'));
    assert.ok(markdown.includes('2. Read the tweet.\n\n   > One.\n   >\n   > Two.\n   >\n   > — A (@a), [2025-09-09](https://twitter.com/a/status/1)\n\n'));
    assert.ok(markdown.includes('- Read the page.\n\n  [COPA](https://aephia.com/copa/)\n\n'));
    assert.ok(markdown.endsWith('- Watch the other video.\n\n  [Another video](https://vimeo.com/1)\n'));
  });

  it('finds the list by any marker, and the item that is nearest', () => {
    const video = '<YouTube id="abc" title="A video" />';
    const replaced = '[A video](https://www.youtube.com/watch?v=abc)';

    for (const [item, indent] of [['* One', '  '], ['+ One', '  '], ['10. Ten', '    '], ['1) One', '   '], ['-', '  ']]) {
      assert.ok(post(`${item}\n\n${indent}${video}`).endsWith(`\n\n${item}\n\n${indent}${replaced}\n`), item);
    }

    const nested = post(`- Outer\n  - Inner\n\n    ${video}\n\n  ${video}\n\n   ${video}`);

    assert.ok(nested.endsWith(`\n\n- Outer\n  - Inner\n\n    ${replaced}\n\n  ${replaced}\n\n  ${replaced}\n`));
  });

  it('places it where the text of its item begins, however far it was indented', () => {
    const markdown = post('- Item\n\n      <YouTube id="abc" title="A video" />\n\n10. Ten\n\n   <Vimeo id="1" title="Too near for the item" />');

    assert.ok(markdown.endsWith('\n\n- Item\n\n  [A video](https://www.youtube.com/watch?v=abc)\n\n10. Ten\n\n[Too near for the item](https://vimeo.com/1)\n'));
  });

  it('follows the text of an item, which goes on wherever its next line starts', () => {
    const video = '<YouTube id="abc" title="A video" />';
    const replaced = '[A video](https://www.youtube.com/watch?v=abc)';
    const inItem = post(`- Item\ngoes on at the margin\n\n  ${video}\n\n1. Step\n\n   A paragraph of the item.\n\n   ${video}\n\n- Item\n\n  A paragraph of the item\nthat goes on at the margin.\n\n  ${video}`);
    const behindList = post(`- Item\n\nA paragraph of its own.\n\n  ${video}\n\nAnother.\n  ${video}`);

    assert.ok(
      inItem.endsWith(
        `\n\n- Item\ngoes on at the margin\n\n  ${replaced}\n\n1. Step\n\n   A paragraph of the item.\n\n   ${replaced}\n\n- Item\n\n  A paragraph of the item\nthat goes on at the margin.\n\n  ${replaced}\n`,
      ),
    );
    assert.ok(behindList.endsWith(`\n\n- Item\n\nA paragraph of its own.\n\n${replaced}\n\nAnother.\n\n${replaced}\n`));
  });

  it('starts the line with what stands in no list, however far it was indented', () => {
    const stray = post('* One\n* Two\n\n <YouTube id="abc" title="A video" />');
    const deep = post('Text.\n\n    <YouTube id="abc" title="A video" />\n\n      <XTweet id="1" authorName="A" date="2025-09-09">\n      One.\n\n      Two.\n      </XTweet>');

    assert.ok(stray.endsWith('\n\n* One\n* Two\n\n[A video](https://www.youtube.com/watch?v=abc)\n'));
    assert.ok(deep.endsWith('\n\nText.\n\n[A video](https://www.youtube.com/watch?v=abc)\n\n> One.\n>\n> Two.\n>\n> — A, [2025-09-09](https://twitter.com/i/web/status/1)\n'));
  });

  it('keeps the lines of a tweet as far from one another as they were typed', () => {
    const markdown = post('- Item\n\n  <XTweet id="1" authorName="A" date="2025-09-09">\n  One.\n    Two, further in.\n  </XTweet>');

    assert.ok(markdown.endsWith('\n\n- Item\n\n  > One.\n  >   Two, further in.\n  >\n  > — A, [2025-09-09](https://twitter.com/i/web/status/1)\n'));
  });

  it('adds no empty lines to a tweet for the video that stands in it', () => {
    const markdown = post('<XTweet id="1" authorName="A" date="2025-09-09">\nWatch this.\n<YouTube id="abc" title="A video" />\n</XTweet>');

    assert.ok(
      markdown.endsWith('\n\n> Watch this.\n>\n> [A video](https://www.youtube.com/watch?v=abc)\n>\n> — A, [2025-09-09](https://twitter.com/i/web/status/1)\n'),
    );
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
    assert.deepEqual(componentsLeft('- ```\n  <Vimeo id="1" />\n  ```\n\n> ~~~\n> <Vimeo id="1" />\n> ~~~'), []);
  });

  it('names a component whose tag holds a backtick', () => {
    assert.deepEqual(componentsLeft("<Spotify title='Don`t' caption='Don`t' />"), ['Spotify']);
  });

  it('names a component whose tag is not closed, wherever it stands', () => {
    assert.deepEqual(componentsLeft('Before <Foo bar\n\n[a link](https://aephia.com/) and <Bar baz `code` <Qux'), ['Foo', 'Bar', 'Qux']);
  });

  it('names a component behind code that a tweet has closed', () => {
    const markdown = post('<XTweet id="1" authorName="A">\n```\ncode\n</XTweet>\n\nAfter <Foo />');

    assert.ok(markdown.endsWith('\n\n> ```\n> code\n>\n> — A, [Tweet](https://twitter.com/i/web/status/1)\n\nAfter <Foo />\n'));
    assert.deepEqual(componentsLeft(markdown), ['Foo']);
  });
});

describe('asTyped', () => {
  it('heads the post as it was typed, for when it cannot be rewritten', () => {
    const markdown = asTyped({ title: 'Five Years', date: DATE, author: 'Funcracker', body: '\n<YouTube id="abc" />\n\n\n\nRead [the guide](/guides/).\n' });

    assert.equal(markdown, '# Five Years\n\nPublished July 18, 2026 by Funcracker.\n\n<YouTube id="abc" />\n\n\n\nRead [the guide](/guides/).\n');
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
