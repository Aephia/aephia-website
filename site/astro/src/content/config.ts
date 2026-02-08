import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    modified: z.string().optional(),
    type: z.enum(['newsletter', 'guide', 'news', 'aephia', 'Newsletter', 'Guide', 'News', 'Aephia']), // Case insensitive support in case
    canonical: z.string().optional(),
    categories: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
    description: z.string().optional(),
    author: z.object({
      name: z.string(),
      slug: z.string().optional(),
      id: z.number().or(z.string()).optional(),
      url: z.string().optional(),
    }).optional(),
    wp: z.object({
      id: z.number().optional(),
    }).optional(),
  }),
});

export const collections = {
  posts: postsCollection,
};
