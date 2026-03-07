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
        <div className='flex flex-col gap-1.5'>
            <h2 className='text-lg font-medium leading-snug'>
                <ColoredLink href={`/${post.id}`}>
                    {post.title}
                </ColoredLink>
            </h2>
            <div className='flex items-center gap-3 text-sm text-gray-500'>
                <span className='inline-flex items-center gap-1'>
                    <Calendar /> <FormattedDate date={post.published} />
                </span>
                {post.categories.length > 0 && (
                    <span className='inline-flex items-center gap-1.5'>
                        {post.categories.map(category => (
                            <ColoredLink key={category} href={`/categories/${category}`}>
                                <span className='inline-block px-2 py-0.5 text-xs rounded-full bg-accent-light text-accent border border-accent-border'>
                                    {category}
                                </span>
                            </ColoredLink>
                        ))}
                    </span>
                )}
            </div>
        </div>
    )
}

const PostList: React.FC<Props> = ({ posts }) => {
    return (
        <ul className='divide-y divide-gray-200'>
            { posts.map(post => {
                return (
                    <li key={post.id} className='py-5 first:pt-0 last:pb-0'>
                        <PostCard post={post} />
                    </li>
                )
            }) }
        </ul>
    )
}

export default PostList
