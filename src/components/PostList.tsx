import React from 'react'
import ColoredLink from './ColoredLink'
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
            <ColoredLink
                href="/[id]"
                as={`/${post.id}`}>
                {post.title}
            </ColoredLink>
        </span>
    )
}

const PostList: React.FC<Props> = ({ posts }) => {
    return (
        <ul>
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
