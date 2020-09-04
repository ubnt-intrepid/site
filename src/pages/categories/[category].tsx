import type { GetStaticProps, GetStaticPaths } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { CategoryIcon } from '../../components/icons'

import { siteTitle, siteDescription } from '../../config'
import { getPosts } from '../../posts'

type Props = {
    categoryName: string
    posts: { id: string; title: string }[]
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const categoryName = params.category as string;
    const posts = getPosts()
        .filter(post => post.categories.includes(categoryName))
        .map(post => ({ id: post.id, title: post.title }));
    return {
        props: {
            categoryName,
            posts
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => {
    const categories = getPosts()
        .map(post => post.categories)
        .reduce((acc, val) => acc.concat(val), []);
    const paths = Array.from(new Set(categories))
        .sort()
        .map(category => ({ params: { category }}));
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
                <span><CategoryIcon />{` ${categoryName}`}</span>
            </h1>
        </div>

        <ul className="container mx-auto px-8 py-6">
            { posts.map(({ id, title }) => {
                return (
                    <li key={id}>
                        <Link href="/[id]" as={`/${id}`}>
                            <a className="no-underline hover:underline text-blue-500">{title}</a>
                        </Link>
                    </li>
                );
            }) }
        </ul>
    </Layout>
);

export default CategoryPage
