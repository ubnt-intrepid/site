import { Metadata } from 'next'
import Link from 'next/link'
import React from 'react'
import Headline from '@/components/Headline'
import { Folder } from '@/components/MaterialIcon'
import { getPosts } from '@/lib/api'
import { collectCounts } from '@/lib/utils'

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
                            <Folder /> <span>{`${name} (${count})`}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </>
    )
}

export default Categories
