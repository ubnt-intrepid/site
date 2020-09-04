import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'

import { siteTitle, siteDescription } from '../config'
import { getPosts } from '../posts'

type Props = {
    posts: { id: string; title: string }[]
}

export const getStaticProps: GetStaticProps = async () => (
    {
        props: {
            posts: getPosts()
                .map(post => ({ id: post.id, title: post.title }))
        } as Props
    }
)

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

export default IndexPage
