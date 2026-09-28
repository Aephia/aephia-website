/**
 * Every post as Markdown, at the post's address with `.md` appended:
 * `/news/five-years-of-aephia-industries.md`.
 */
import type { APIRoute } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { markdownResponse, postPaths } from '../../lib/posts';

export const getStaticPaths = postPaths;

export const GET: APIRoute<{ post: CollectionEntry<'posts'> }> = ({ props, site }) => markdownResponse(props.post, site);
