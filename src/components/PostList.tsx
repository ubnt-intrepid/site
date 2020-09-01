import Link from 'next/link'
import Date from './Date'
import { PostMetadata } from '../posts'

export type Props = {
    posts: PostMetadata[]
}

const PostList = ({ posts }: Props) => (
    <ul>
        { posts.map(({ id, date, title }) => {
            return (
                <li key={id}>
                    <Link href="/[id]" as={`/${id}`}>
                        <a>{title}</a>
                    </Link>
                    {' - '}
                    <span>
                        <Date dateString={date} />
                    </span>
                </li>
            );
        }) }
    </ul>
);

export default PostList
