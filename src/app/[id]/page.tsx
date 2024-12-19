import assert from 'node:assert/strict'
import { Metadata } from 'next'
import React from 'react'
import ColoredLink from '@/components/ColoredLink'
import Comments from '@/components/Comments'
import Container from '@/components/Container'
import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Markdown from '@/components/Markdown'
import { Calendar, Folder, Tag, Edit } from '@/components/MaterialIcon'
import { siteRepoUrl } from '@/config'
import { getPosts } from '@/lib/post'


export type Params = {
    id: string
}

export const generateStaticParams = async () => {
    const posts = await getPosts()
    return posts.map(({ id }) => ({ id })) satisfies Params[]
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { id } = await params
    const posts = await getPosts()
    const post = posts.find(post => post.id == id)
    return {
        title: post?.title,
    } satisfies Metadata
}

const PostPage = async ({ params }: { params: Promise<Params> }) => {
    const { id } = await params
    const posts = await getPosts()
    const post = posts.find(post => post.id === id)
    if (!post) {
        assert.fail(`invalid post id: ${id}`)
    }
    const { sourcePath, title, published, categories, tags, content } = post
    const sourceUrl = `${siteRepoUrl}/blob/main/_posts/${sourcePath}`;

    return (
        <>
            <Headline title={title ?? ""} href={`/${id}`}>
                <p className='mt-3'>
                    <Calendar /> <FormattedDate date={published} />
                </p>
            </Headline>

            <Container>
                <Markdown content={content} />

                <div className='flex justify-between text-center text-sm'>
                    <span className='categories'>
                        { categories.map(category => (
                            <span className='inline-block p-2' key={category}>
                                <ColoredLink href={`/categories/${category}`}>
                                    <Folder /> {category}
                                </ColoredLink>
                            </span>
                        ))}
                    </span>
                    <span className='tags'>
                        { tags.map(tag => (
                            <span className='inline-block p-2' key={tag}>
                                <ColoredLink href={`/tags/${tag}`}>
                                    <Tag /> {tag}
                                </ColoredLink>
                            </span>
                        ))}
                    </span>

                    <span className='share-icons'>
                        <span className='inline-block p-2'>
                            <ColoredLink href={sourceUrl} title='Source' target='_blank'>
                                <Edit />
                            </ColoredLink>
                        </span>
                    </span>
                </div>

                <div className='mt-12'>
                    <Comments />
                </div>
            </Container>
        </>
    )
}

export default PostPage