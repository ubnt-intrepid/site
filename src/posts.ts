import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import toml from 'toml'

import remark from 'remark'
import footnotes from 'remark-footnotes'
import remark2rehype from 'remark-rehype'
import raw from 'rehype-raw'
import highlight from 'rehype-highlight'
import html from 'rehype-stringify'

export type Post = {
    id: string
    title?: string
    date?: string
    tags?: string[]
    categories?: string[]
    contentRaw: string
    contentHtml: string
}

export const getPosts = () => {
    const postsDirectory = path.join(process.cwd(), 'posts')
    const postIds = fs.readdirSync(postsDirectory)
        .map(fileName => fileName.replace(/\.md$/, ''))

    let posts = new Map<string, Post>();
    for (const id of postIds) {
        const fullPath = path.join(postsDirectory, `${id}.md`)
        const fileContents = fs.readFileSync(fullPath, 'utf8')
        const matterResult = matter(fileContents, {
            language: 'toml',
            delimiters: '+++',
            engines: {
                toml: {
                    parse: toml.parse.bind(toml),
                    stringify: function() {
                        throw new Error('cannot stringify to TOML');
                    }
                },
            },
        })

        const {
            title,
            date,
            taxonomies: {
                tags: tagsRaw,
                categories: categoriesRaw,
            },
        } = matterResult.data as {
            title?: string
            date?: string
            taxonomies?: {
                tags?: string[]
                categories?: string[]
            }
        }
        const tags = tagsRaw ?? []
        const categories = categoriesRaw ?? []

        const contentRaw = matterResult.content;
        const processedContent = remark()
            .use(footnotes, { inlineNotes: true })
            .use(remark2rehype, { allowDangerousHtml: true })
            .use(raw)
            .use(highlight, { ignoreMissing: true })
            .use(html)
            .processSync(contentRaw)
        const contentHtml = processedContent.toString()

        posts.set(id, {
            id,
            title,
            date,
            tags,
            categories,
            contentRaw,
            contentHtml,
        } as Post)
    }

    return Array.from(posts.values())
        .sort((a, b) => (a.date < b.date ? 1 : -1))
}
