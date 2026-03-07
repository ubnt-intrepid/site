import React from 'react'
import Container from '@/components/Container'
import Headline from '@/components/Headline'
import Pagination from '@/components/Pagination'
import PostList from '@/components/PostList'
import { siteDescription, siteTitle } from '@/config'
import { getPaginatedPosts, getTotalPages } from '@/lib/pagination'

type Params = {
    n: string
}

export const generateStaticParams = async () => {
    const totalPages = await getTotalPages()
    return Array.from({ length: totalPages }, (_, i) => ({
        n: String(i + 1),
    })) satisfies Params[]
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { n } = await params
    return {
        title: `Posts - Page ${n}`,
    }
}

const PostsPage = async ({ params }: { params: Promise<Params> }) => {
    const { n } = await params
    const page = Number(n)
    const { posts, currentPage, totalPages } = await getPaginatedPosts(page)

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

export default PostsPage
