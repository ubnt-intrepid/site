import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import { collectCounts, getPosts } from '../../src/lib'

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
            <div className='hero'>
                <h1 className='title'>Categories</h1>
            </div>

            <ul className='container mx-auto px-8 py-6'>
                { categories.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/categories/${name}`} className='no-underline hover:underline text-blue-500'>
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
