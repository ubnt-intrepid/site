import React from 'react'
import Headline from '@/components/Headline'
import PostList from '@/components/PostList'
import { siteDescription, siteTitle } from '@/config'
import { getPosts } from '@/lib/api'

const IndexPage: React.FC = async () => {
    const posts = await getPosts()
    return (
        <>
            <Headline title={siteTitle} href={"/"} subtitle={siteDescription} />
            <PostList posts={posts} />
        </>
    )
}

export default IndexPage
