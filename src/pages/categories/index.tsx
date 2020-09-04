import { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { CategoryIcon } from '../../components/icons'

import { siteTitle } from '../../constants'
import { getPosts } from '../../api'
import collectCounts from '../../collectCounts'

type Props = {
    categories: {
        name: string
        count: number
    }[]
}

export const getStaticProps: GetStaticProps = async () => {
    const posts = await getPosts()
    const categories = collectCounts(
        posts
            .reduce((acc, post) => acc.concat(post.categories), [])
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
