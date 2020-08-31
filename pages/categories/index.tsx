import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'

import { siteTitle } from '../../lib/config'
import { getPostsMetadata } from '../../lib/posts'
import { collectCounts } from '../../lib/util'

type Props = {
    categories: {
        name: string
        count: number
    }[]
}

export const getStaticProps: GetStaticProps = async () => {
    const categories = collectCounts(
        getPostsMetadata()
            .reduce((acc, post) => acc.concat(post.taxonomies.categories), [])
    );
    return {
        props: { categories } as Props
    };
}

const CategoriesPage = ({ categories }: Props) => (
    <>
        <Head>
            <title>{`Categories - ${siteTitle}`}</title>
        </Head>

        <Header />

        <section className="hero">
            <div className="hero-body has-text-centered">
                <div className="container">
                    <h1 className="title">Categories</h1>
                </div>
            </div>
        </section>

        <main className="container">
            <div className="container has-text-centered">
                <div className="columns">
                    <div className="column is-8 is-offset-2">
                        <div className="list box">
                            <div className="tags is-centered">
                                {categories.map(({ name, count }) => (
                                    <span className="tag is-link is-light is-medium">
                                        <Link href={`/categories/${name}`}>
                                            <a>
                                                <span>{`#${name} (${count})`}</span>
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

export default CategoriesPage
