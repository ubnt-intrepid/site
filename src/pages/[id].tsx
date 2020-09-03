import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import Date from '../components/Date'
import Utterances from '../components/Utterances'
import { CalendarIcon, CategoryIcon, TagIcon, GitHubIcon, BookmarkIcon, TwitterIcon } from '../components/icons'

import { baseUrl, siteTitle, siteRepoUrl } from '../config'
import { getPosts } from '../posts'

type Props = {
    id: string
    title?: string
    date?: string
    tags?: string[]
    categories?: string[]
    contentHtml: string
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const posts = getPosts()
    const id = params.id as string
    const { title, date, tags, categories, contentHtml } = posts.find(post => post.id === id)
    return {
        props: {
            id,
            title,
            date,
            tags,
            categories,
            contentHtml,
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => (
    {
        paths: getPosts().map(post => ({ params: { id: post.id } })),
        fallback: false,
    }
)

const PostPage = ({ id, title, date, tags, categories, contentHtml }: Props) => {
    const permalink = `${baseUrl}/${id}/`;
    const pageTitle = `${title} - ${siteTitle}`;
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`;
    const bookmarkUrl = `http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`;
    const sourceUrl = `${siteRepoUrl}/blob/master/posts/${id}.md`;

    return (
        <Layout>
            <Head>
                <title>{pageTitle}</title>
            </Head>

            <div className="hero">
                <h1 className="title">
                    <Link href={`/${id}`}>
                        <a>{title}</a>
                    </Link>
                </h1>
                <p className="mt-3">
                    <CalendarIcon />&nbsp;<Date dateString={date} />
                </p>
            </div>

            <div className="container article">
                <div className="article-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />

                <div className="article-footer">
                    <span>
                        { categories.map(category => (
                            <span className="card" key={category}>
                                <Link href={`/categories/${category}`} >
                                    <a><CategoryIcon />{` ${category}`}</a>    
                                </Link>
                            </span>
                        )) }

                        { tags.map(tag => (
                            <span className="card" key={tag}>
                                <Link href={`/tags/${tag}`}>
                                    <a><TagIcon />{` ${tag}`}</a>
                                </Link>
                            </span>
                        )) }
                    </span>

                    <span>
                        <span className="card">
                            <a href={tweetUrl} target="_blank" title="Tweet"><TwitterIcon /></a>
                        </span>

                        <span className="card">
                            <a href={bookmarkUrl} target="_blank" title="Bookmark"><BookmarkIcon /></a>
                        </span>

                        <span className="card">
                            <a href={sourceUrl} target="_blank" title="Source"><GitHubIcon /></a>
                        </span>
                    </span>
                </div>

                <div>
                    <Utterances />
                </div>
            </div>
        </Layout>
    );
}

export default PostPage
