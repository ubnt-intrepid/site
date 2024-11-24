import { Metadata } from 'next'
import Link from 'next/link'
import FormattedDate from '@/components/FormattedDate'
import Headline from '@/components/Headline'
import Utterances from '@/components/Utterances'
import { Calendar, Folder, GitHub, Hatena, Tag, Twitter } from '@/components/icons'
import { baseUrl, siteRepoUrl, siteTitle } from '@/config'
import { getPostBySlug, getPostSlugs } from '@/lib/api'
import markdownToHtml from '@/lib/markdownToHtml'

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
    const tags = rawTags ?? []
    const categories = rawCategories ?? []
    const permalink = `${baseUrl}/${slug}/`;
    const pageTitle = `${title} - ${siteTitle}`;
    const tweetUrl = `https://twitter.com/intent/tweet?url=${encodeURI(permalink)}&text=${encodeURI(pageTitle)}`;
    const bookmarkUrl = `http://b.hatena.ne.jp/add?mode=confirm&url=${encodeURI(permalink)}&t=${encodeURI(pageTitle)}`;
    const sourceUrl = `${siteRepoUrl}/blob/master/_posts/${slug}.md`;
    const content = await markdownToHtml(rawContent)
    return (
        <>
            <Headline title={title ?? ""} href={`/${slug}`}>
                <p className='mt-3'>
                    <Calendar /> <FormattedDate date={date} />
                </p>
            </Headline>

            <div className='article'>
                <div className='article-body'
                    dangerouslySetInnerHTML={{ __html: content }} />

                <div className='article-footer'>
                    <span>
                        { categories.map(category => (
                            <span className='card' key={category}>
                                <Link href={`/categories/${category}`}>
                                    <Folder /> {category}
                                </Link>
                            </span>
                        ))}
                    </span>
                    <span>
                        { tags.map(tag => (
                            <span className='card' key={tag}>
                                <Link href={`/tags/${tag}`}>
                                    <Tag /> {tag}
                                </Link>
                            </span>
                        ))}
                    </span>

                    <span>
                        <span className='card'>
                            <a href={tweetUrl} target='_blank' title='Tweet'>
                                <Twitter />
                            </a>
                        </span>

                        <span className='card'>
                            <a href={bookmarkUrl} target='_blank' title='Bookmark'>
                                <Hatena />
                            </a>
                        </span>

                        <span className='card'>
                            <a href={sourceUrl} target='_blank' title='Source'>
                                <GitHub />
                            </a>
                        </span>
                    </span>
                </div>
            </div>
            <Utterances />
        </>
    )
}

export default PostPage