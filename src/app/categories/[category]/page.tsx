import React from 'react'
import Link from 'next/link'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import { Folder } from '@/components/MaterialIcon'
import PostList from '@/components/PostList'
import { getPosts } from '@/lib/post'

export type Params = {
    category: string
}

export async function generateStaticParams() {
    const posts = await getPosts()
    const categories = posts
        .map(post => post.categories ?? [])
        .reduce((acc, val) => acc.concat(val), [])
    return Array.from(new Set(categories))
        .sort()
        .map(category => ({ category } satisfies Params as Params))
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { category } = await params
    return {
        title: `Category: ${category}`
    }
}

const Category = async ({ params }: { params: Promise<Params> }) => {
    const { category } = await params
    const posts = (await getPosts()).filter(post => post.categories ? post.categories.includes(category) : false)
    return (
        <>
            <Headline title={
                <Link href={`/categories/${category}`}>
                    <Folder /> {category}
                </Link>
            } />
            <Container>
                <PostList posts={posts} />
            </Container>
        </>
    )
}

export default Category 
