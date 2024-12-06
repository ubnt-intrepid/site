import { Metadata } from 'next'
import React from 'react'
import ColoredLink from '@/components/ColoredLink'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import { Folder } from '@/components/MaterialIcon'
import { getPosts } from '@/lib/post'
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
            <Container>
                <ul>
                    { categories.map(({ name, count }) => (
                        <li key={name}>
                            <ColoredLink href={`/categories/${name}`}>
                                <Folder /> <span>{`${name} (${count})`}</span>
                            </ColoredLink>
                        </li>
                    ))}
                </ul>
            </Container>
        </>
    )
}

export default Categories
