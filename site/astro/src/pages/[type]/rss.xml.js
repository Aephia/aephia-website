import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function getStaticPaths() {
  const types = ['newsletters', 'guides', 'news', 'aephia'];
  return types.map((type) => ({ params: { type } }));
}

export async function GET(context) {
  const { type } = context.params;
  const posts = await getCollection('posts');
  
  const urlToContentType = {
    newsletters: 'newsletter',
    guides: 'guide',
    news: 'news',
    aephia: 'aephia'
  };

  const contentType = urlToContentType[type];
  
  // Filter by type
  const filteredPosts = posts.filter((post) => post.data.type?.toLowerCase() === contentType);
  const sortedPosts = filteredPosts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: `Aephia Industries - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
    description: `Latest ${type} from Aephia Industries`,
    site: context.site,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: `/${type}/${post.slug}/`,
    })),
  });
}
