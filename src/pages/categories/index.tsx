import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../../components/Header'
import Footer from '../../components/Footer'
import { CategoryIcon } from '../../components/icons'

import { siteTitle } from '../../config'
import { getPostsMetadata } from '../../posts'
import { collectCounts } from '../../util'

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

        <main>
            <h1>Categories</h1>

            <ul>
                { categories.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/categories/${name}`}>
                            <a>
                                <CategoryIcon />
                                <span>{` ${name} (${count})`}</span>
                            </a>
                        </Link>
                    </li>
                )) }
            </ul>
        </main>

        <Footer />
    </>
)

export default CategoriesPage
