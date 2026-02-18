import { getCollection, type CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await getCollection('posts');

  const contentTypeToUrl: Record<string, string> = {
    newsletter: 'newsletters',
    guide: 'guides',
    news: 'news',
    aephia: 'aephia'
  };

  return posts.map((post) => {
    const type = post.data.type?.toLowerCase() || 'news';
    const urlType = contentTypeToUrl[type] || 'news';
    
    return {
      params: { type: urlType, slug: post.slug },
      props: { post },
    };
  });
}

interface Props {
  post: CollectionEntry<'posts'>;
}

export async function GET({ props }: { props: Props }) {
  const { post } = props;
  return new Response(post.body, {
    headers: { 
      'Content-Type': 'text/plain; charset=utf-8'
    },
  });
}
