import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import toml from 'toml'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { Handlers } from 'mdast-util-to-hast'
import { Code } from 'mdast'
import { Element, Properties } from 'hast'

const postsDir = path.join(process.cwd(), '_posts')

export type Post = {
    slug: string 
    title?: string 
    date?: string
    tags?: string[]
    categories?: string[]
    rawContent: string
}

export const getPostSlugs = async () => {
    const rawSlugs = await fs.readdir(postsDir)
    const slugs = rawSlugs.map(slug => slug.replace(/\.md$/, ''))
    return slugs
}

export const getPosts = async () => {
    const slugs = await getPostSlugs()
    const posts = await Promise.all(
        slugs.map(async slug => await getPostBySlug(slug))
    )
    return posts.sort((a, b) => {
        if (!a.date) {
            return -1
        }
        if (!b.date) {
            return 1
        }
        return a.date < b.date ? 1 : -1
    })
}

export const getPostBySlug = async (slug: string) => {
    const fullPath = path.join(postsDir, `${slug}.md`)
    const fileContents = await fs.readFile(fullPath, 'utf8')

    const { data, content: rawContent } = matter(fileContents, {
        language: 'toml',
        delimiters: '+++',
        engines: {
            toml: {
                parse: toml.parse.bind(toml),
                stringify: () => {
                    throw new Error('cannot stringify to TOML')
                }
            }
        }
    })
    const {
        title,
        date,
        tags: rawTags,
        categories: rawCategories,
        taxonomies,
    } = data as {
        title?: string
        date?: string 
        tags?: string[]
        categories?: string[]
        taxonomies?: {
            tags?: string[]
            categories?: string[]
        }
    }
    let tags = rawTags ?? []
    let categories = rawCategories ?? []
    if (taxonomies) {
        tags = tags.concat(taxonomies.tags ?? [])
        categories = categories.concat(taxonomies.categories ?? [])
    }

    return {
        slug,
        title,
        date,
        tags,
        categories,
        rawContent
    } as Post
}

export const markdownToHtml = async (rawContent: string) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkRehype, {
            allowDangerousHtml: true,
            handlers: {
                code: (state, node: Code) => {
                    const value = node.value ? node.value + '\n' : ''
                    const properties: Properties = {}
                    
                    if (node.lang) {
                        properties.className = ['language-' + node.lang]
                    }

                    let codeResult: Element = {
                        type: 'element',
                        tagName: 'code',
                        properties,
                        children: [{ type: 'text', value }]
                    }
                    state.patch(node, codeResult)
                    codeResult = state.applyData(node, codeResult)

                    let title: Element | null = null
                    if (node.meta) {
                        title = {
                            type: 'element',
                            tagName: 'span',
                            properties: {
                                className: ['title'],
                            },
                            children: [{ type: 'text', value: node.meta }]
                        }
                    }

                    const preResult: Element = {
                        type: 'element',
                        tagName: 'pre',
                        properties: {},
                        children: [codeResult],
                    }

                    const result: Element = {
                        type: 'element',
                        tagName: 'div',
                        properties: {
                            className: ['code-block'],
                        },
                        children: title ? [title, preResult] : [preResult],
                    }
                    if (node.meta) {
                        result.data = { meta: node.meta }
                    }
                    state.patch(node, result)
                    return state.applyData(node, result)
                }
            } as Handlers
        })
        .use(rehypeRaw)
        .use(rehypeHighlight)
        .use(rehypeKatex)
        .use(rehypeStringify)
        .process(rawContent)
    return parsed.toString()
}

export const collectCounts = (values: string[]) => {
    const countsMap = new Map<string, number>();
    values
        .forEach(value => {
            const count = countsMap.get(value);
            countsMap.set(value, count ? count + 1 : 1);
        });

    return Array.from(countsMap.entries())
        .map(([name, count]) => ({ name, count }));
}
