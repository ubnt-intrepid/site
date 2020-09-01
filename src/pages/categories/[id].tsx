import type { GetStaticProps, GetStaticPaths } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { CategoryIcon } from '../../components/icons'

import { siteTitle } from '../../config'
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
    <Layout>
        <Head>
            <title>{`Category: ${categoryName} - ${siteTitle}`}</title>
        </Head>

        <div className="hero">
            <h1 className="title">
                <CategoryIcon />{` ${categoryName}`}
            </h1>
        </div>

        <ul className="container mx-auto px-8 py-6">
            { posts.map(({ id, date, title }) => {
                return (
                    <li key={id}>
                        <Link href="/[id]" as={`/${id}`}>
                            <a className="no-underline hover:underline text-blue-500">{title}</a>
                        </Link>
                        {' - '}
                    </li>
                );
            }) }
        </ul>
    </Layout>
);

export default CategoryPage
