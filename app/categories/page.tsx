import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { collectCounts, getPosts } from '../../src/lib'
import Headline from '../components/Headline'

export const metadata: Metadata = {
    title: 'Categories',
}

const Categories: React.FC = async () => {
    const posts = await getPosts()
    const categories = collectCounts(
        posts
            .map(post => post.categories ?? [])
            .reduce((acc, tags) => acc.concat(tags), [])
    )
    return (
        <>
            <Headline title="Categories" />
            <ul className='entries'>
                { categories.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/categories/${name}`}>
                            <i className='fas fa-folder' aria-hidden />
                            &nbsp;
                            <span>{`${name} (${count})`}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    )
}

export default Categories
