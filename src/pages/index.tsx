import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import PostList from '../components/PostList'

import { siteTitle, siteDescription } from '../config'
import { getPostsMetadata, PostMetadata } from '../posts'

type Props = {
    posts: PostMetadata[]
}

export const getStaticProps: GetStaticProps = async () => (
    {
        props: { posts: getPostsMetadata() } as Props
    }
)

const IndexPage = ({ posts }: Props) => {
    return (
        <>
            <Head>
                <title>{siteTitle}</title>
            </Head>

            <Header hideSiteTitle={true} />

            <main>
                <h1>
                    <Link href="/">
                        <a>{siteTitle}</a>
                    </Link>
                </h1>

                <h2>{siteDescription}</h2>

                <PostList posts={posts} />
            </main>

            <Footer />
        </>
    );
}

export default IndexPage
