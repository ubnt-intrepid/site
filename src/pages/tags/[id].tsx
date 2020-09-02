import type { GetStaticProps, GetStaticPaths } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../../components/Layout'
import { TagIcon } from '../../components/icons'

import { siteTitle } from '../../config'
import { PostMetadata, getPostsMetadata } from '../../posts'

type Props = {
    tagName: string
    posts: PostMetadata[]
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const tagName = params.id as string;
    const posts = getPostsMetadata()
        .filter(post => post.taxonomies.tags.includes(tagName));
    return {
        props: {
            tagName,
            posts,
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => {
    const tags = getPostsMetadata()
        .map(post => post.taxonomies.tags)
        .reduce((acc, val) => acc.concat(val), []);
    const paths = Array.from(new Set(tags))
        .sort()
        .map(id => ({ params: { id }}));
    return {
        paths,
        fallback: false,
    }
}

const TagPage = ({ tagName, posts }: Props) => (
    <Layout>
        <Head>
            <title>{`Tag: ${tagName} - ${siteTitle}`}</title>
        </Head>

        <div className="hero">
            <h1 className="title">
                <TagIcon />{` ${tagName}`}
            </h1>
        </div>

        <ul className="container mx-auto px-8 py-6">
            { posts.map(({ id, date, title }) => {
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
)

export default TagPage
