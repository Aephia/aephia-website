import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { tweetAuthor } from './tweet.ts';

describe('tweetAuthor', () => {
  it('does not double the @ of a handle that is written with one', () => {
    assert.equal(tweetAuthor('Chypto', '@Chypto_'), 'Chypto (@Chypto_)');
  });

  it('gives an @ to a handle that is written without one', () => {
    assert.equal(tweetAuthor('Star Atlas', 'staratlas'), 'Star Atlas (@staratlas)');
  });

  it('is not misled by spaces around the handle', () => {
    assert.equal(tweetAuthor('Chypto', ' @Chypto_ '), 'Chypto (@Chypto_)');
  });

  it('leaves out a handle that is not known', () => {
    assert.equal(tweetAuthor('Chypto'), 'Chypto');
    assert.equal(tweetAuthor('Chypto', ''), 'Chypto');
    assert.equal(tweetAuthor('Chypto', '@'), 'Chypto');
    assert.equal(tweetAuthor('Chypto', ' '), 'Chypto');
  });

  it('leaves out a name that is not known', () => {
    assert.equal(tweetAuthor(undefined, '@Chypto_'), '(@Chypto_)');
    assert.equal(tweetAuthor(), '');
  });
});
