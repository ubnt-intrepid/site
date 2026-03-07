import { Post, getPosts } from './post'

const POSTS_PER_PAGE = 10

export type PaginatedPosts = {
    posts: Post[]
    currentPage: number
    totalPages: number
}

export async function getPaginatedPosts(page: number): Promise<PaginatedPosts> {
    const allPosts = await getPosts()
    const totalPages = Math.ceil(allPosts.length / POSTS_PER_PAGE)
    const start = (page - 1) * POSTS_PER_PAGE
    const posts = allPosts.slice(start, start + POSTS_PER_PAGE)
    return { posts, currentPage: page, totalPages }
}

export function getAllPageNumbers(): number[] {
    // This is called at build time by generateStaticParams
    // We can't use async getPosts here easily, so we export this
    // and let the caller handle it
    return []
}

export async function getTotalPages(): Promise<number> {
    const allPosts = await getPosts()
    return Math.ceil(allPosts.length / POSTS_PER_PAGE)
}

export function getPageHref(page: number): string {
    return page === 1 ? '/' : `/posts/${page}/`
}
