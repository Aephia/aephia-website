# Content Repository

> [!WARNING]
> **DO NOT EDIT FILES IN THIS DIRECTORY MANUALLY.**
> 
> These files are automatically generated from WordPress. Any manual changes made here will be **overwritten** the next time the post is updated in WordPress.

## Overview

This directory contains the MDX content for the Aephia website, migrated automatically from our WordPress backend.

## Architecture

- **Source of Truth**: WordPress (Aephia.com)
- **Pipeline**: Cloudflare Worker (`wordpress-to-cf`)
- **Format**: MDX (Markdown + Components)

## Frontmatter Standard

All posts include the following automated metadata:
- `title`: Post title
- [date](cci:1://file:///Users/ronaldtreur/Development/Aephia/wordpress-to-cf/src/pipeline/github.ts:97:0-177:1): Publish/Modified date
- `type`: Content category (e.g., `news`, `guide`, `newsletter`)
- `description`: Cleaned excerpt for SEO
- `image`: Featured image (mirrored to R2, immutable URL)
- `wp.id`: Original WordPress Database ID

## Components

The pipeline automatically converts embeds into custom Astro components:
- `<YouTube id="..." />`: Optimized video embeds
- `<XTweet id="..." />`: Static Twitter/X cards
- `<WpEmbed url="..." />`: Generic WordPress embeds