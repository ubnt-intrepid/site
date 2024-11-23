import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { collectCounts, getPosts } from '../../src/lib'
import Headline from '../components/Headline'

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
            <Headline title="Tags" />
            <ul className='entries'>
                { tags.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/tags/${name}`}>
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
