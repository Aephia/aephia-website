import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('posts');
  
  // Sort by date desc
  const sortedPosts = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Aephia Industries - Latest Posts',
    description: 'News, Guides, and Updates from Aephia Industries.',
    site: context.site,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      // Compute link based on type mapping
      link: `/${getLinkPrefix(post.data.type)}/${post.slug}/`,
    })),
  });
}

function getLinkPrefix(type) {
  const map = {
    newsletter: 'newsletters',
    guide: 'guides',
    news: 'news',
    aephia: 'aephia'
  };
  return map[type?.toLowerCase()] || 'news';
}
