import type { GetStaticProps, GetStaticPaths } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import PostList from '../../components/PostList'
import { CategoryIcon } from '../../components/icons'

import { PostMetadata, getPostsMetadata } from '../../posts'

type Props = {
    categoryName: string
    posts: PostMetadata[]
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const categoryName = params.id as string;
    const posts = getPostsMetadata()
        .filter(post => post.taxonomies.categories.includes(categoryName));
    return {
        props: {
            categoryName,
            posts,
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => {
    const categories = getPostsMetadata()
        .map(post => post.taxonomies.categories)
        .reduce((acc, val) => acc.concat(val), []);
    const paths = Array.from(new Set(categories))
        .sort()
        .map(id => ({ params: { id }}));
    return {
        paths,
        fallback: false,
    }
}

const CategoryPage = ({ categoryName, posts }: Props) => (
    <>
        <Head>
            <title>{`Category - ${categoryName}`}</title>
        </Head>

        <Header />

        <main>
            <h1><CategoryIcon />{` ${categoryName}`}</h1>
            <PostList posts={posts} />
        </main>

        <Footer />
    </>
)

export default CategoryPage
