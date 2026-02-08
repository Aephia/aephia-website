# Aephia Website (Astro)

This directory contains the Astro-based website for Aephia.

## Project Structure

- `src/`: Source code (Astro components, pages, styles)
- `public/`: Static assets
- `dist/`: Build output (created after running build)

## Content

The MDX content is located in `../../../content/posts` and symlinked to `src/content/posts`.
This allows the Astro site to consume the existing content repository.

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
