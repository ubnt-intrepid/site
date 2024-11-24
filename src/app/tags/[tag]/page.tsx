import React from 'react'
import Link from 'next/link'
import Headline from '@/components/Headline'
import { Tag as TagIcon } from '@/components/icons'
import { getPosts } from '@/lib/api'

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
            <Headline title={<span><TagIcon /> {tag}</span>} />

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

export default Tag
