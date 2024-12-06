import React from 'react'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import PostList from '@/components/PostList'
import { siteDescription, siteTitle } from '@/config'
import { getPosts } from '@/lib/post'

const IndexPage: React.FC = async () => {
    const posts = await getPosts()
    return (
        <>
            <Headline title={siteTitle} href={"/"} subtitle={siteDescription} />
            <Container>
                <PostList posts={posts} />
            </Container>
        </>
    )
}

export default IndexPage
