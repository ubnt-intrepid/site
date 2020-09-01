import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
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
    <Layout>
        <Head>
            <title>{`Categories - ${siteTitle}`}</title>
        </Head>

        <div className="hero">
            <h1 className="title">Categories</h1>
        </div>

        <ul className="container mx-auto px-8 py-6">
            { categories.map(({ name, count }) => (
                <li key={name}>
                    <Link href={`/categories/${name}`}>
                        <a className="no-underline hover:underline text-blue-500">
                            <CategoryIcon />
                            <span>{` ${name} (${count})`}</span>
                        </a>
                    </Link>
                </li>
            )) }
        </ul>
    </Layout>
)

export default CategoriesPage
