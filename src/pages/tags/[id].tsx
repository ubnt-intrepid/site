import type { GetStaticProps, GetStaticPaths } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PostList from '../../components/PostList'
import { TagIcon } from '../../components/icons'

import { PostMetadata, getPostsMetadata } from '../../posts'

type Props = {
    tagName: string
    posts: PostMetadata[]
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const tagName = params.id as string;
    const posts = getPostsMetadata()
        .filter(post => post.taxonomies.tags.includes(tagName));
    return {
        props: {
            tagName,
            posts,
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => {
    const tags = getPostsMetadata()
        .map(post => post.taxonomies.tags)
        .reduce((acc, val) => acc.concat(val), []);
    const paths = Array.from(new Set(tags))
        .sort()
        .map(id => ({ params: { id }}));
    return {
        paths,
        fallback: false,
    }
}

const TagPage = ({ tagName, posts }: Props) => (
    <>
        <Head>
            <title>{`Tag - ${tagName}`}</title>
        </Head>

        <Header />

        <main>
            <h1><TagIcon />{` ${tagName}`}</h1>
            <PostList posts={posts} />
        </main>

        <Footer />
    </>
)

export default TagPage
