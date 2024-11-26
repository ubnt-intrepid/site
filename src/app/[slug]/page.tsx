import { Metadata } from 'next'
import Link from 'next/link'
import React, { Fragment } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { codeToHast } from 'shiki'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Comments from '@/components/Comments'
import { Calendar, Folder, Tag, Edit } from '@/components/MaterialIcon'
import { siteRepoUrl } from '@/config'
import { getPosts } from '@/lib/api'
import markdownToJsx from '@/lib/markdownToJsx'

export type Params = {
    slug: string
}

export const generateStaticParams = async () => {
    const posts = await getPosts()
    return posts.map(({ slug }) => ({ slug })) satisfies Params[] as Params[]
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const posts = await getPosts()
    const { title } = posts.find(post => post.slug == slug) ?? {}
    return {
        title,
    } satisfies Metadata
}

type CodeBlockProps = {
    lang?: string
    title?: string
    content?: string
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

const CodeBlock: React.FC<CodeBlockProps> = async ({ lang, title, content }) => {
    const hast = await codeToHast(content ?? '', {
        lang: canonicalizeLanguageName(lang),
        theme: 'vitesse-light',
    })
    return toJsxRuntime(hast, {
        Fragment,
        jsx,
        jsxs,
        components: {
            pre: props => {
                return (
                    <div className='code-block'>
                        { title ? <span className='title'>{title}</span> : null}
                        <pre {...props} />
                    </div>
                )
            }
        }
    })
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
    const content = await markdownToJsx(rawContent ?? "", CodeBlock)

    return (
        <>
            <Headline title={title ?? ""} href={`/${slug}`}>
                <p className='mt-3'>
                    <Calendar /> <FormattedDate date={date} />
                </p>
            </Headline>

            <div className='article'>
                <div className='article-body'>{content}</div>

                <div className='article-footer'>
                    <span className='categories'>
                        { categories.map(category => (
                            <span className='card' key={category}>
                                <Link href={`/categories/${category}`}>
                                    <Folder /> {category}
                                </Link>
                            </span>
                        ))}
                    </span>
                    <span className='tags'>
                        { tags.map(tag => (
                            <span className='card' key={tag}>
                                <Link href={`/tags/${tag}`}>
                                    <Tag /> {tag}
                                </Link>
                            </span>
                        ))}
                    </span>

                    <span className='share-icons'>
                        <span className='card'>
                            <a href={sourceUrl} target='_blank' title='Source'>
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