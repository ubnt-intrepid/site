import { parseISO, format } from 'date-fns'
import { Metadata } from 'next'
import Link from 'next/link'
import { baseUrl, siteRepoUrl, siteTitle } from '../../src/consts'
import { getPostBySlug, getPostSlugs, markdownToHtml } from '../../src/lib'
import Utterances from '../components/Utterances'

export type Params = {
    slug: string
}

export const generateStaticParams = async () => {
    const posts = await getPostSlugs()
    return posts.map(slug => ({ slug })) satisfies Params[] as Params[]
}

export const generateMetadata = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const { title } = await getPostBySlug(slug)
    return {
        title,
    } satisfies Metadata
}

const PostPage = async ({ params }: { params: Promise<Params> }) => {
    const { slug } = await params
    const { title, date, tags: rawTags, categories: rawCategories, rawContent } = await getPostBySlug(slug)
    const formattedDate = date ? format(parseISO(date), 'yyyy/MM/dd') : null
    const tags = rawTags ?? []
    const categories = rawCategories ?? []
    const permalink = `${baseUrl}/${slug}/`;
    const pageTitle = `${title} - ${siteTitle}`;
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`;
    const bookmarkUrl = `http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`;
    const sourceUrl = `${siteRepoUrl}/blob/master/_posts/${slug}.md`;    const content = await markdownToHtml(rawContent)
    return (
        <>
            <div className='hero'>
                <h1 className='title'>
                    <Link href={`/${slug}`}>{title}</Link>
                </h1>
                <p className='mt-3'>
                    <i className='far fa-calendar' aria-hidden />
                    &nbsp;
                     <time dateTime={date}>
                        {formattedDate}
                    </time>
                </p>
            </div>
            <div className='container article'>
                <div className='article-body'
                    dangerouslySetInnerHTML={{ __html: content }} />
                <div className='article-footer'>
                    <span>
                        { categories.map(category => (
                            <span className='card' key={category}>
                                <Link href={`/categories/${category}`}>
                                    <i className='fas fa-folder' aria-hidden />
                                    &nbsp;
                                    {category}
                                </Link>
                            </span>
                        ))}
                    </span>
                    <span>
                        { tags.map(tag => (
                            <span className='card' key={tag}>
                                <Link href={`/tags/${tag}`}>
                                <i className='fas fa-tag' aria-hidden />
                                    &nbsp;
                                    {tag}
                                </Link>
                            </span>
                        ))}
                    </span>

                    <span>
                        <span className='card'>
                            <a href={tweetUrl} target='_blank' title='Tweet'>
                                <i className='fab fa-twitter' aria-hidden/>
                            </a>
                        </span>

                        <span className='card'>
                            <a href={bookmarkUrl} target='_blank' title='Bookmark'>
                                <i className='fab fa-hatena' aria-hidden/>
                            </a>
                        </span>

                        <span className='card'>
                            <a href={sourceUrl} target='_blank' title='Source'>
                                <i className='fab fa-github' aria-hidden/>
                            </a>
                        </span>
                    </span>
                </div>

                <div>
                    <Utterances />
                </div>
            </div>
        </>
    )
}

export default PostPage