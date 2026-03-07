import React from 'react'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import Pagination from '@/components/Pagination'
import PostList from '@/components/PostList'
import { siteDescription, siteTitle } from '@/config'
import { getPaginatedPosts } from '@/lib/pagination'

const IndexPage: React.FC = async () => {
    const { posts, currentPage, totalPages } = await getPaginatedPosts(1)
    return (
        <>
            <Headline title={siteTitle} href={"/"} subtitle={siteDescription} />
            <Container>
                <PostList posts={posts} />
                <Pagination currentPage={currentPage} totalPages={totalPages} />
            </Container>
        </>
    )
}

export default IndexPage
