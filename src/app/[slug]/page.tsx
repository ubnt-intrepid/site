import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { codeToHtml } from 'shiki'
import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Utterances from '@/components/Utterances'
import { Calendar, Folder, GitHub, Hatena, Tag, Twitter } from '@/components/icons'
import { baseUrl, siteRepoUrl, siteTitle } from '@/config'
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
    const html = await codeToHtml(content ?? '', {
        lang: canonicalizeLanguageName(lang),
        theme: 'vitesse-light',
    })
    return (
        <div className='code-block'>
            { title ? <span className='title'>{title}</span> : null}
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    )
}

const PostPage = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const posts = await getPosts()
    const { title, date, tags: rawTags, categories: rawCategories, rawContent } = posts.find(post => post.slug === slug) ?? {}
    const tags = rawTags ?? []
    const categories = rawCategories ?? []
    const permalink = `${baseUrl}/${slug}/`;
    const pageTitle = `${title} - ${siteTitle}`;
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`;
    const bookmarkUrl = `http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`;
    const sourceUrl = `${siteRepoUrl}/blob/master/_posts/${slug}.md`;
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
                    <span>
                        { categories.map(category => (
                            <span className='card' key={category}>
                                <Link href={`/categories/${category}`}>
                                    <Folder /> {category}
                                </Link>
                            </span>
                        ))}
                    </span>
                    <span>
                        { tags.map(tag => (
                            <span className='card' key={tag}>
                                <Link href={`/tags/${tag}`}>
                                    <Tag /> {tag}
                                </Link>
                            </span>
                        ))}
                    </span>

                    <span>
                        <span className='card'>
                            <a href={tweetUrl} target='_blank' title='Tweet'>
                                <Twitter />
                            </a>
                        </span>

                        <span className='card'>
                            <a href={bookmarkUrl} target='_blank' title='Bookmark'>
                                <Hatena />
                            </a>
                        </span>

                        <span className='card'>
                            <a href={sourceUrl} target='_blank' title='Source'>
                                <GitHub />
                            </a>
                        </span>
                    </span>
                </div>
            </div>
            <Utterances />
        </>
    )
}

export default PostPage