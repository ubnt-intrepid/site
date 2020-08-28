import { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import Header from '../components/Header'
import Footer from '../components/Footer'
import Utterances from '../components/Utterances'
import Date from '../components/Date'

import { baseUrl, siteTitle, siteRepoUrl } from '../lib/config'
import { loadPost, getPostIds, Taxonomies } from '../lib/posts'

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
    // FIXME: sanitize generated HTML
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
    const editRequestUrl = `${siteRepoUrl}/edit/master/posts/${id}.md`;

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
            </Head>

            <Header />

            <main className="container">
                <section className="container">
                    <div className="columns is-desktop">
                        <div className="column is-10-desktop is-offset-1-desktop">
                            <article>
                                <div className="card article">
                                    <div className="card-content">
                                        <div className="media">
                                            <div className="media-content has-text-centered">
                                                <Link href={`/${id}`}>
                                                    <a>
                                                        <p className="title article-title">{title}</p>
                                                    </a>
                                                </Link>

                                                <div className="tags has-addons level-item">
                                                    <span className="tag is-rounded">
                                                        <i className="far fa-calendar" aria-hidden="true"></i>
                                                        &nbsp;<Date dateString={date} />
                                                    </span>

                                                    {taxonomies.categories ? (
                                                        taxonomies.categories.map(category => (
                                                            <span className="tag is-rounded is-hidden-mobile" key={category}>
                                                                <Link href={`/categories/${category}`} >
                                                                    <a>
                                                                        <i className="fas fa-folder" aria-hidden="true"></i>
                                                                        {` ${category}`}
                                                                    </a>    
                                                                </Link>
                                                            </span>
                                                        ))
                                                    ) : null}

                                                    <span className="tag is-rounded is-hidden-mobile">
                                                        <a href={editRequestUrl}>
                                                            <i className="far fa-file" aria-hidden="true"></i>
                                                            {' Source'}
                                                        </a>
                                                    </span>

                                                    <span className="tag is-rounded">
                                                        <a href={`https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`}
                                                            target="_blank"
                                                            title="Tweet">
                                                            <i className="fab fa-twitter" aria-hidden="true"></i>
                                                            <span className="is-hidden-mobile">{' Share'}</span>
                                                        </a>
                                                    </span>

                                                    <span className="tag is-rounded">
                                                        <a href={`http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`}
                                                            target="_blank"
                                                            title="Bookmark">
                                                            <i className="fa fa-hatena" aria-hidden="true"></i>
                                                            <span className="is-hidden-mobile">Bookmark</span>
                                                        </a>
                                                    </span>
                                                </div>

                                                { taxonomies.tags ? (
                                                    <div className="tags level-item">
                                                        {taxonomies.tags.map(tag => (
                                                            <span className="tag is-link is-light">
                                                                <Link href={`/tags/${tag}`}>
                                                                    <a>{`#${tag}`}</a>
                                                                </Link>
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null }
                                            </div>
                                        </div>

                                        <div className="content article-body" dangerouslySetInnerHTML={{ __html: contentHtml }} />

                                        <Utterances />
                                    </div>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </>
    );
}

export default PostPage
