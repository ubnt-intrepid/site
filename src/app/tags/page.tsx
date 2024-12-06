import { Metadata } from 'next'
import React from 'react'
import ColoredLink from '@/components/ColoredLink'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import { Tag } from '@/components/MaterialIcon'
import { getPosts } from '@/lib/post'
import { collectCounts } from '@/lib/utils'

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
            <Container>
                <ul>
                    { tags.map(({ name, count }) => (
                        <li key={name}>
                            <ColoredLink href={`/tags/${name}`}>
                                <Tag /> <span>{`${name} (${count})`}</span>
                            </ColoredLink>
                        </li>
                    ))}
                </ul>
            </Container>
        </>
    )
}

export default Tags
