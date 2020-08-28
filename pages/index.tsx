import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import PostList from '../components/PostList'

import { siteTitle, siteDescription } from '../lib/config'
import { getPostsMetadata, PostMetadata } from '../lib/posts'

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

            <main className="container">
                <section className="hero">
                    <div className="hero-body has-text-centered">
                        <div className="container">
                            <Link href="/">
                                <a>
                                    <h1 className="title">{siteTitle}</h1>
                                </a>
                            </Link>
                            <h2 className="subtitle">{siteDescription}</h2>
                        </div>
                    </div>
                </section>

                <PostList posts={posts} />
            </main>

            <Footer />
        </>
    );
}

export default IndexPage
