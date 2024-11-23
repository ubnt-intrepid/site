import React from 'react'
import Link from 'next/link'
import { getPosts } from '@/lib'
import Headline from '../../components/Headline'

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
                <span>
                    <i className='fas fa-folder' aria-hidden />
                    &nbsp;
                    {category}
                </span>
            } />
            <ul className='entries'>
                { posts.map(({ slug, title }) => {
                    return (
                        <li key={slug}>
                            <Link href="/[slug]" as={`/${slug}`}>
                                {title}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}

export default Category 
