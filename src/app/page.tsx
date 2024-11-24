import Link from 'next/link'
import React from 'react'
import Headline from '@/components/Headline'
import { siteDescription, siteTitle } from '@/config'
import { getPosts } from '@/lib/api'

const IndexPage: React.FC = async () => {
    const rawPosts = await getPosts()
    const posts = rawPosts.map(({ title, slug }) => ({ title, slug }))
    return (
        <>
            <Headline title={siteTitle} href={"/"} subtitle={siteDescription} />
            <ul className='entries'>
                {posts.map(({ title, slug }) => {
                    return (
                        <li key={slug}>
                            <Link href="/[slug]" as={`/${slug}`}>{title}</Link>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}

export default IndexPage
