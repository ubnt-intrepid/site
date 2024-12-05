import Link from 'next/link'
import React from 'react'
import { Calendar } from './MaterialIcon'
import FormattedDate from './FormattedDate'
import { Post } from '@/lib/post'

export type Props = {
    posts: Post[]
}

const PostCard = ({ post }: { post: Post }) => {
    return (
        <span>
            <Calendar /> <FormattedDate date={post.published} />
            &nbsp; - &nbsp;
            <Link
                href="/[id]"
                as={`/${post.id}`}
                className='no-underline text-orange-600 hover:underline'>
                {post.title}
            </Link>
        </span>
    )
}

const PostList: React.FC<Props> = ({ posts }) => {
    return (
        <ul className='container mx-auto px-8 py-6'>
            { posts.map(post => {
                return (
                    <li key={post.id}>
                        <PostCard post={post} />
                    </li>
                )
            }) }
        </ul>
    )
}

export default PostList
