/**
 * How a tweet names its author, shared by the tweet on the page and the one in
 * the post's Markdown so that the two cannot drift apart.
 *
 * The posts write the handle with its @ (`authorHandle="@Chypto_"`); written
 * with or without, it is given one.
 */
export function tweetAuthor(name?: string, handle?: string): string {
  const bare = handle?.trim().replace(/^@/, '');

  return [name, bare && `(@${bare})`].filter(Boolean).join(' ');
}
