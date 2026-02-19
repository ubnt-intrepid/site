# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal technical blog ("missing documentation for life") by @ubnt-intrepid. A statically-generated Next.js site deployed to Netlify. Content is written in Japanese.

## Commands

```bash
pnpm install         # Install dependencies
pnpm dev             # Dev server with Turbopack (localhost:3000)
pnpm build           # Production build (static export to ./out/)
pnpm new-post <slug> [-t <title>] [--mdx]  # Create a new blog post
```

No test framework is configured.

## Architecture

### Static Export with App Router

Next.js is configured with `output: 'export'` and `trailingSlash: true`. All pages are statically generated at build time to `./out/`. There is no server-side runtime.

### Custom Markdown Pipeline

The most significant architectural decision: instead of using react-markdown or the official MDX compiler, the site builds its own **micromark → mdast AST → React component** pipeline.

- `src/lib/markdown.ts` — Parses `.md` (CommonMark+GFM+math) and `.mdx` (adds JSX/expressions) into mdast AST. Performs a custom `flatMap` pass to resolve references, extract frontmatter, convert JSX elements to custom nodes (e.g., `<Alert>` → Alert node), and strip expressions/HTML.
- `src/components/Markdown.tsx` — Recursive AST-to-React renderer. Walks the mdast tree and maps each node type to a React component.
- `src/lib/post.ts` — Discovers posts from `_posts/`, parses frontmatter (YAML: title, published, categories, tags), and caches metadata.

### Content Structure

Blog posts live in `_posts/{year}/` as `.md` or `.mdx` files. The filename (without extension) becomes the URL slug (`/[id]/`). Frontmatter format:

```yaml
---
title: Post Title
published: 2024-11-23T12:49:06+09:00
categories: [ "general" ]
tags: [ "blog" ]
---
```

### Supported Markdown Extensions

- GFM (tables, strikethrough, task lists, autolinks)
- Math via KaTeX (`$inline$`, `$$display$$`)
- MDX JSX: only `<Alert kind="note|tip|important|warning|caution">` is recognized
- MDX expressions are stripped (used only for in-document comments)
- Footnotes with reference links
- Code syntax highlighting via Shiki (`vitesse-light` theme)

### Route Structure

- `/` — Post listing (home)
- `/[id]/` — Individual post
- `/tags/` and `/tags/[tag]/` — Tag index and filtered listing
- `/categories/` and `/categories/[category]/` — Category index and filtered listing

All dynamic routes use `generateStaticParams()`.

### Key Components

- `src/components/Code.tsx` — Server component for Shiki syntax highlighting
- `src/components/Math.tsx` — KaTeX rendering (display/inline)
- `src/components/Alert.tsx` — Callout boxes (note/tip/important/warning/caution)
- `src/components/Header.tsx` — Client component (`'use client'`) for navigation

### Styling

Tailwind CSS 3 with PostCSS (postcss-import → tailwindcss/nesting → tailwindcss). Orange accent color (#ff8c00). Custom font stacks with Japanese font support (Hiragino).

## Conventions

- Path alias: `@/*` maps to `./src/*`
- `@typescript-eslint/no-explicit-any` is disabled
- Site configuration (URLs, author info) lives in `src/config.ts`
- Netlify deployment from `./out/` with SPA fallback redirect
