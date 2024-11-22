import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { collectCounts, getPosts } from '../../src/lib'

export const metadata: Metadata = {
    title: 'Tags',
}

const Tags: React.FC = async () => {
    const posts = await getPosts()
    const tags = collectCounts(
        posts
            .map(post => post.tags ?? [])
            .reduce((acc, tags) => acc.concat(tags), [])
    )
    return (
        <>
            <div className='hero'>
                <h1 className='title'>Tags</h1>
            </div>

            <ul className='container mx-auto px-8 py-6'>
                { tags.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/tags/${name}`} className='no-underline hover:underline text-blue-500'>
                            <i className='fas fa-tag' aria-hidden />
                            &nbsp;
                            <span>{`${name} (${count})`}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    )
}

export default Tags
