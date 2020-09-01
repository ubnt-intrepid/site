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

        <main>
            <h1>Tags</h1>

            <ul>
                { tags.map(({ name, count }) => (
                    <li key={name}>
                        <Link href={`/tags/${name}`}>
                            <a>
                                <TagIcon />
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

export default TagsPage
