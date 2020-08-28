import Link from 'next/link'
import Date from './Date'
import { PostMetadata } from '../lib/posts'

export type Props = {
    posts: PostMetadata[]
}

const PostList = ({ posts }: Props) => (
    <section className="articles">
        <div className="column is-8 is-offset-2">
            <ul>
                {posts.map(({ id, date, title }) => {
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
                })}
            </ul>
        </div>
    </section>
);

export default PostList
