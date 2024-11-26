import Link from 'next/link'
import React from 'react'
import { Calendar } from './MaterialIcon'
import FormattedDate from './FormattedDate'
import { Post } from '@/lib/api'

export type Props = {
    posts: Post[]
}

const PostCard = ({ post }: { post: Post }) => {
    const { title, date, slug } = post
    return (
        <span>
            <Calendar /> <FormattedDate date={date} />
            &nbsp; - &nbsp;
            <Link href="/[slug]" as={`/${slug}`}>{title}</Link>
        </span>
    )
}

const PostList: React.FC<Props> = ({ posts }) => {
    return (
        <ul className='entries'>
            { posts.map(post => {
                return (
                    <li key={post.slug}>
                        <PostCard post={post} />
                    </li>
                )
            }) }
        </ul>
    )
}

export default PostList
