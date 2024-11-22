import Link from 'next/link'
import React from 'react'
import { siteTitle, siteDescription } from '../src/consts'
import { getPosts } from '../src/lib'

const IndexPage: React.FC = async () => {
    const rawPosts = await getPosts()
    const posts = rawPosts.map(({ title, slug }) => ({ title, slug }))
    return (
        <>
            <div className='hero'>
                <h1 className='title'>
                    <Link href="/">{siteTitle}</Link>
                </h1>
                <p className='subtitle'>
                    {siteDescription}
                </p>
            </div>

            <ul className='container mx-auto px-8 py-6'>
                {posts.map(({ title, slug }) => {
                    return (
                        <li key={slug}>
                            <Link href="/[slug]" as={`/${slug}`}
                                className='no-underline hover:underline text-blue-500'>
                                {title}
                            </Link>
                        </li>
                    )
                })}
            </ul>
        </>
    )
}

export default IndexPage
