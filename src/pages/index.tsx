import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'

import { siteTitle, siteDescription } from '../constants'
import { getPosts } from '../api'

type Props = {
    posts: {
        slug: string
        title: string
    }[]
}

export const getStaticProps: GetStaticProps = async () => {
    const posts = await getPosts()
    return {
        props: {
            posts: posts
                .map(({ slug, title }) => ({ slug, title })),
        } as Props
    }
}

const IndexPage = ({ posts }: Props) => (
    <Layout hideSiteTitle>
        <Head>
            <title>{siteTitle}</title>
        </Head>

        <div className="hero">
            <h1 className="title">
                <Link href="/">
                    <a>{siteTitle}</a>
                </Link>
            </h1>
            <p className="subtitle">{siteDescription}</p>
        </div>

        <ul className="container mx-auto px-8 py-6">
            { posts.map(({ slug, title }) => {
                return (
                    <li key={slug}>
                        <Link href="/[slug]" as={`/${slug}`}>
                            <a className="no-underline hover:underline text-blue-500">{title}</a>
                        </Link>
                    </li>
                );
            }) }
        </ul>
    </Layout>
);

export default IndexPage
