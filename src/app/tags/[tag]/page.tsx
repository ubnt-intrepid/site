import React from 'react'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import { Tag as TagIcon } from '@/components/MaterialIcon'
import PostList from '@/components/PostList'
import { getPosts } from '@/lib/post'
import Link from 'next/link'

export type Params = {
    tag: string
}

export const generateStaticParams = async () => {
    const posts = await getPosts()
    const tags = posts
        .map(post => post.tags ?? [])
        .reduce((acc, val) => acc.concat(val), [])
    return Array.from(new Set(tags))
        .sort()
        .map(tag => ({ tag } as Params))
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { tag } = await params
    return {
        title: `Tag: ${tag}`
    }
}

const Tag = async ({ params }: { params: Promise<Params> }) => {
    const { tag } = await params
    const posts = (await getPosts()).filter(post => post.tags ? post.tags.includes(tag) : false)
    return (
        <>
            <Headline title={
                <Link href={`/tags/${tag}`}>
                    <TagIcon /> {tag}
                </Link>
            } />
            <Container>
                <PostList posts={posts} />
            </Container>
        </>
    )
}

export default Tag
