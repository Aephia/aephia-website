# Aephia Website (Astro)

This directory contains the Astro-based website for Aephia.

## Project Structure

- `src/`: Source code (Astro components, pages, styles)
- `public/`: Static assets
- `dist/`: Build output (created after running build)

## Content

The MDX content is located in `../../../content/posts` and symlinked to `src/content/posts`.
This allows the Astro site to consume the existing content repository.

## Posts as Markdown

Every post is also served as plain Markdown, at its own address with `.md` appended:
`/news/five-years-of-aephia-industries.md`. The "Copy" button on each post copies that text,
links to it, and hands its address to ChatGPT or Claude.

- `src/pages/[type]/[slug].md.ts` and `src/pages/sa-medium/[slug].md.ts`: the endpoints.
- `src/lib/page-markdown.ts`: rewrites the embed components (`<YouTube>`, `<Vimeo>`, `<WpEmbed>`, `<XTweet>`)
  as Markdown. A new embed component needs a rewrite here. Until it has one, its tag stands in the Markdown as it
  was typed: the build says so in a line that starts with `[markdown]`, and `npm test` fails.
- `src/lib/tweet.ts`: how a tweet names its author, shared by `XTweet.astro` and the Markdown.
- The addresses are built from `site` in `astro.config.mjs`, which must be the address the site is served from.
- `public/_headers`: keeps the `.md` addresses out of search engines, which should list the page instead.

## Developing Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Building for Production

To create a production build:

```bash
npm run build
```

This will generate the static site in the `dist/` directory.

## Testing

```bash
npm test
```

Runs the tests in `src/lib` with Node's own test runner (Node 22.18 or later). They need nothing installed.

GitHub runs them on every pull request and on every push to `main`, the bot's included
(`.github/workflows/test.yml`). They do not stand in the way of the build on Cloudflare Pages.

## Cloudflare Pages Deployment

This project is configured for deployment on Cloudflare Pages.

**Settings:**

- **Framework Preset:** Astro
- **Build Command:** `npm run build`
- **Build Output Directory:** `dist`
- **Root Directory:** `site/astro` (if connecting the monorepo)

**Environment Variables:**

- `NODE_VERSION`: `20` (Recommended)

## Troubleshooting MDX

If the build fails due to MDX errors:
1. Check the error log for specific files and line numbers.
2. Common issues include:
   - Unescaped `<` characters (replace with `&lt;`).
   - Invalid JSX tags (e.g., `<unknown>`).
   - Multi-line component tags that MDX parses incorrectly (consolidate to single line).
   - Unclosed tags or invalid HTML nesting.
   - `<br>` tags in component children/props (must be `<br />`).

Scripts are available to help:
- `python3 ../../fix_mdx_tags.py`: Consolidates multi-line `<XTweet>` tags.
