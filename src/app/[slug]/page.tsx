import { Metadata } from 'next'
import Link from 'next/link'
import React, { Fragment } from 'react'
import * as prod from 'react/jsx-runtime'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypeClassNames from 'rehype-class-names'
import rehypeReact, { Components } from 'rehype-react'
import { Code } from 'mdast'
import { Handlers, State } from 'mdast-util-to-hast'
import { Element } from 'hast'
import { h } from 'hastscript'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { visit } from 'unist-util-visit'
import { codeToHast } from 'shiki'

import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Comments from '@/components/Comments'
import { Calendar, Folder, Tag, Edit } from '@/components/MaterialIcon'
import { siteRepoUrl } from '@/config'
import { getPosts } from '@/lib/api'

const remarkCalloutDirectives = () => {
    return (tree: any) => {
        visit(tree, (node) => {
            if (
                node.type !== 'containerDirective' &&
                node.type !== 'leafDirective' &&
                node.type !== 'textDirective'
            ) {
                return
            }

            if (node.name !== 'callout') {
                return
            }

            const data = node.data || (node.data = {})
            const tagName = node.type === 'textDirective' ? 'span' : 'div'

            const attributes = node.attributes || {}
            const className = attributes.className || (attributes.className = [])
            className.push('bg-orange-50 px-5 py-3 my-10 rounded relative')

            data.hName = tagName
            data.hProperties = h(tagName, attributes).properties
        })
    }
}

const mdCodeBlockHandler = (state: State, node: Code) => {
    let result: Element = {
        type: 'element',
        tagName: 'my-code-block',
        properties: {
            lang: node.lang,
            title: node.meta,
            content: node.value ? node.value + '\n' : '',
        },
        children: [],
    }
    state.patch(node, result)
    result = state.applyData(node, result)

    return result
}

const canonicalizeLanguageName = (lang?: string) => {
    if (!lang) {
        return 'txt'
    }
    if (lang === 'shell-session' || lang === 'command') {
        return 'shellsession'
    }
    return lang
}

const CodeBlock: React.FC<{
    lang?: string
    title?: string
    content?: string
}> = async ({ lang, title, content }) => {
    const hast = await codeToHast(content ?? '', {
        lang: canonicalizeLanguageName(lang),
        theme: 'vitesse-dark',
    })
    return toJsxRuntime(hast, {
        Fragment,
        jsx: prod.jsx,
        jsxs: prod.jsxs,
        components: {
            pre: props => {
                return title ? (
                    <div className='my-6'>
                        <span className='
                            inline-block
                            px-2
                            py-1
                            -mb-px
                            rounded-t-sm
                            text-sm
                            font-mono
                            font-bold
                            bg-orange-600
                            text-orange-50
                        '>
                            {title}
                        </span>
                        <pre {...props} className='mt-0' />
                    </div>
                ) : (
                    <div>
                        <pre {...props} />
                    </div>
                )
            }
        }
    })
}

const MarkdownArticle: React.FC<{
    content?: string
}> = async ({ content }) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkCalloutDirectives)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkRehype, {
            allowDangerousHtml: true,
            handlers: { code: mdCodeBlockHandler } as Handlers
        })
        .use(rehypeRaw)
        .use(rehypeKatex)
        .use(rehypeClassNames, {
            'p,ul,ol,pre,figure,blockquote': 'my-6',
            'hr': 'flex mx-auto w-20',
            'h1': 'text-3xl mt-5 mb-3',
            'h2': 'text-2xl mt-5 mb-3',
            'h3,h4,h5,h6': 'text-xl mt-5 mb-3',
            'a': 'no-underline text-orange-600 hover:underline',
            'ul,ol': 'list-outside pl-4',
            'li': 'ml-6',
            'ul': 'list-disc',
            'ol': 'list-decimal',
            'figure': 'text-center',
            'img': 'block mx-auto',
            'figcaption': 'text-sm',
        })
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
            components: {
                'my-code-block': CodeBlock,
            } as Partial<Components>,
        })
        .process(content)
    return (
        <article className='px-4 py-6'>
            {parsed.result}
        </article>
    )
}

// ---

export type Params = {
    slug: string
}

export const generateStaticParams = async () => {
    const posts = await getPosts()
    return posts.map(({ slug }) => ({ slug })) satisfies Params[]
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const posts = await getPosts()
    const { title } = posts.find(post => post.slug == slug) ?? {}
    return {
        title,
    } satisfies Metadata
}

const PostPage = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const posts = await getPosts()
    const post = posts.find(post => post.slug === slug)
    if (!post) {
        return (
            <div>Failed to get post</div>
        )
    }
    const { title, date, tags, categories, content: rawContent, mdPath } = post
    const sourceUrl = `${siteRepoUrl}/blob/master/_posts/${mdPath}`;

    return (
        <>
            <Headline title={title ?? ""} href={`/${slug}`}>
                <p className='mt-3'>
                    <Calendar /> <FormattedDate date={date} />
                </p>
            </Headline>

            <div className='container mx-auto content-center'>
                <MarkdownArticle content={rawContent} />

                <div className='flex justify-between text-center text-sm'>
                    <span className='categories'>
                        { categories.map(category => (
                            <span className='inline-block p-2' key={category}>
                                <Link href={`/categories/${category}`} className='no-underline text-orange-600 hover:underline'>
                                    <Folder /> {category}
                                </Link>
                            </span>
                        ))}
                    </span>
                    <span className='tags'>
                        { tags.map(tag => (
                            <span className='inline-block p-2' key={tag}>
                                <Link href={`/tags/${tag}`} className='no-underline text-orange-600 hover:underline'>
                                    <Tag /> {tag}
                                </Link>
                            </span>
                        ))}
                    </span>

                    <span className='share-icons'>
                        <span className='inline-block p-2'>
                            <a href={sourceUrl} target='_blank' title='Source' className='no-underline text-orange-600 hover:underline'>
                                <Edit />
                            </a>
                        </span>
                    </span>
                </div>
            </div>
            <Comments />
        </>
    )
}

export default PostPage