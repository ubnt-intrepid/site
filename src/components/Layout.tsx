import React from 'react'
import Link from 'next/link'

import { authorName, authorUrl, siteTitle } from '../config'

export type Props = {
    children?: React.ReactNode
    hideSiteTitle?: boolean
}

const Layout = ({ children, hideSiteTitle } : Props) => {
    return (
        <div className="flex flex-col min-h-screen">
            <header className="flex items-center justify-between py-2 bg-gray-200">
                <div className="px-2">
                    { hideSiteTitle ? null : <Link href="/"><a>{siteTitle}</a></Link> }
                </div>
                <ul className="inline-flex items-center">
                    <li className="px-2 md:px-4"><Link href="/tags"><a>Tags</a></Link></li>
                    <li className="px-2 md:px-4"><Link href="/categories"><a>Categories</a></Link></li>
                </ul>
            </header>

            <main className="mb-auto">
                {children}
            </main>

            <footer className="bg-gray-200">
                <p className="text-center text-xs p-2">
                    &copy; 2019-2020 <strong><a href={authorUrl} target="_blank">{authorName}</a></strong>.
                </p>
            </footer>
        </div>
    );
}

export default Layout
