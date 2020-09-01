import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import Date from '../components/Date'

import { siteTitle, siteDescription } from '../config'
import { getPostsMetadata, PostMetadata } from '../posts'
import { CalendarIcon } from '../components/icons'

type Props = {
    posts: PostMetadata[]
}

export const getStaticProps: GetStaticProps = async () => (
    {
        props: { posts: getPostsMetadata() } as Props
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
