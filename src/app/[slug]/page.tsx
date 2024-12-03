import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import Comments from '@/components/Comments'
import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Markdown from '@/components/Markdown'
import { Calendar, Folder, Tag, Edit } from '@/components/MaterialIcon'
import { siteRepoUrl } from '@/config'
import { getPosts } from '@/lib/api'


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
                <Markdown>
                    {rawContent}
                </Markdown>

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