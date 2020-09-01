import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Layout from '../components/Layout'
import Date from '../components/Date'
import Utterances from '../components/Utterances'
import { CalendarIcon, CategoryIcon, TagIcon, GitHubIcon, BookmarkIcon, TwitterIcon } from '../components/icons'

import { baseUrl, siteTitle, siteRepoUrl } from '../config'
import { loadPost, getPostIds, Taxonomies } from '../posts'

import remark from 'remark'
import footnotes from 'remark-footnotes'
import remark2rehype from 'remark-rehype'
import highlight from 'rehype-highlight'
import html from 'rehype-stringify'

type Props = {
    id: string
    title?: string
    date?: string
    taxonomies?: Taxonomies
    contentHtml: string
}

export const getStaticProps: GetStaticProps = async ({ params }) => {
    const id = params.id as string
    const { title, date, taxonomies, contentRaw } = loadPost(id)
    const contentHtml = await remark()
        .use(footnotes, { inlineNotes: true })
        .use(remark2rehype)
        .use(highlight, { ignoreMissing: true })
        .use(html)
        .process(contentRaw)
        .then(processedContent => processedContent.toString())
    return {
        props: {
            id,
            title,
            date,
            taxonomies,
            contentHtml,
        } as Props
    }
}

export const getStaticPaths: GetStaticPaths = async () => (
    {
        paths: getPostIds().map(id => ({ params: { id } })),
        fallback: false,
    }
)

const PostPage = ({ id, title, date, taxonomies, contentHtml }: Props) => {
    const permalink = `${baseUrl}/${id}/`;
    const pageTitle = `${title} - ${siteTitle}`;
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`;
    const bookmarkUrl = `http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`;
    const sourceUrl = `${siteRepoUrl}/blob/master/posts/${id}.md`;

    const categories = taxonomies.categories ?? [];
    const tags = taxonomies.tags ?? [];

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

                <div className="mt-2">
                    <span>
                        <CalendarIcon />&nbsp;<Date dateString={date} />
                    </span>
                    { categories.map(category => (
                    <span key={category} className="ml-3">
                        <Link href={`/categories/${category}`} >
                            <a><CategoryIcon />{` ${category}`}</a>    
                        </Link>
                    </span>
                    )) }
                </div>

                <div className="mt-4">
                    <span className="mx-2">
                        <a href={tweetUrl} target="_blank" title="Tweet"><TwitterIcon />{' Share'}</a>
                    </span>

                    <span className="mx-2">
                        <a href={bookmarkUrl} target="_blank" title="Bookmark"><BookmarkIcon />{' Bookmark'}</a>
                    </span>

                    <span className="mx-2">
                        <a href={sourceUrl} target="_blank" title="Source"><GitHubIcon />{' Source'}</a>
                    </span>
                </div>
            </div>

            <div className="mx-auto text-center py-1 bg-gray-200">
                { tags.map(tag => (
                    <span key={tag} className="mx-2">
                        <Link href={`/tags/${tag}`}>
                            <a><TagIcon />{` ${tag}`}</a>
                        </Link>
                    </span>
                    )) }
            </div>

            <div className="container mx-auto px-4 py-6 article-body"
                dangerouslySetInnerHTML={{ __html: contentHtml }} />

            <Utterances />
        </Layout>
    );
}

export default PostPage
