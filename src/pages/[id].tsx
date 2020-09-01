import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
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
        <>
            <Head>
                <title>{pageTitle}</title>
            </Head>

            <Header />

            <main>
                <article>
                    <header>
                        <h1>
                            <Link href={`/${id}`}>
                                <a>
                                    <p className="title article-title">{title}</p>
                                </a>
                            </Link>
                        </h1>

                        <ul>
                            <li>
                                <CalendarIcon />&nbsp;<Date dateString={date} />
                            </li>

                            <li>
                                <a href={tweetUrl} target="_blank" title="Tweet"><TwitterIcon />{' Share'}</a>
                            </li>

                            <li>
                                <a href={bookmarkUrl} target="_blank" title="Bookmark"><BookmarkIcon />{' Bookmark'}</a>
                            </li>

                            <li>
                                <a href={sourceUrl} target="_blank" title="Source"><GitHubIcon />{' Source'}</a>
                            </li>

                            { categories.map(category => (
                                <li key={category}>
                                    <Link href={`/categories/${category}`} >
                                        <a><CategoryIcon />{` ${category}`}</a>    
                                    </Link>
                                </li>
                              )) }

                            { tags.map(tag => (
                                <li key={tag}>
                                    <Link href={`/tags/${tag}`}>
                                        <a><TagIcon />{` ${tag}`}</a>
                                    </Link>
                                </li>
                              )) }

                        </ul>
                    </header>

                    <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                </article>

                <Utterances />

            </main>

            <Footer />
        </>
    );
}

export default PostPage
