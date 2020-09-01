import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { TagIcon } from '../../components/icons'

import { siteTitle } from '../../config'
import { getPostsMetadata } from '../../posts'
import { collectCounts } from '../../util'

type Props = {
    tags: {
        name: string
        count: number
    }[]
}

export const getStaticProps: GetStaticProps = async () => {
    const tags = collectCounts(
        getPostsMetadata()
            .reduce((acc, post) => acc.concat(post.taxonomies.tags), [])
    );
    return {
        props: { tags } as Props
    };
}

const TagsPage = ({ tags }: Props) => (
    <>
        <Head>
            <title>{`Tags - ${siteTitle}`}</title>
        </Head>

        <Header />

        <section className="hero">
            <div className="hero-body has-text-centered">
                <div className="container">
                    <h1 className="title">Tags</h1>
                </div>
            </div>
        </section>

        <main className="container">
            <div className="container has-text-centered">
                <div className="columns">
                    <div className="column is-8 is-offset-2">
                        <div className="list box">
                            <div className="tags is-centered">
                                {tags.map(({ name, count }) => (
                                    <span className="tag is-link is-light is-medium">
                                        <Link href={`/tags/${name}`}>
                                            <a>
                                                <TagIcon />
                                                <span>{` ${name} (${count})`}</span>
                                            </a>
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
        <Footer />
    </>
)

export default TagsPage
