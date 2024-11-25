import React from 'react'
import Headline from '@/components/Headline'
import { Folder } from '@/components/icons'
import { getPosts } from '@/lib/api'
import PostList from '@/components/PostList'

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
            <Headline title={<span><Folder /> {category}</span>} />
            <PostList posts={posts} />
        </>
    )
}

export default Category 
