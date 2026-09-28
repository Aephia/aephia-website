/**
 * Every Star Atlas Medium article as Markdown, at the article's address with
 * `.md` appended.
 */
import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { markdownResponse, saMediumPaths } from '../../lib/posts';

export const getStaticPaths = saMediumPaths;

export const GET: APIRoute<{ post: CollectionEntry<'sa-medium'> }> = ({ props, site }) => markdownResponse(props.post, site);
