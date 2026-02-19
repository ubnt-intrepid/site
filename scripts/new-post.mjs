import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);

function usage() {
  console.error("Usage: pnpm new-post <slug> [-t|--title <title>] [--mdx]");
  process.exit(1);
}

let slug = null;
let title = null;
let mdx = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "-t" || arg === "--title") {
    title = args[++i];
    if (!title) {
      console.error("Error: --title requires a value");
      process.exit(1);
    }
  } else if (arg === "--mdx") {
    mdx = true;
  } else if (arg.startsWith("-")) {
    console.error(`Error: unknown option '${arg}'`);
    usage();
  } else if (!slug) {
    slug = arg;
  } else {
    console.error("Error: unexpected argument");
    usage();
  }
}

if (!slug) {
  usage();
}

if (!title) {
  title = slug;
}

const now = new Date();
const year = now.getFullYear();
const published = `${year}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

const ext = mdx ? ".mdx" : ".md";
const dir = join("_posts", String(year));
const filePath = join(dir, `${slug}${ext}`);

if (existsSync(filePath)) {
  console.error(`Error: ${filePath} already exists`);
  process.exit(1);
}

mkdirSync(dir, { recursive: true });

const content = `---
title: "${title}"
published: ${published}
categories: [ "general" ]
tags: []
---
`;

writeFileSync(filePath, content, "utf-8");
console.log(`Created: ${filePath}`);
