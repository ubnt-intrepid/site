'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { siteTitle } from '@/config'

const Header: React.FC = () => {
    const pathname = usePathname()
    const isRoot = pathname === '/'
    return (
        <header>
            <div className="title">
                {isRoot ? null : <Link href="/">{siteTitle}</Link>}
            </div>
            <nav>
                <ul>
                    <li><Link href="/tags">Tags</Link></li>
                    <li><Link href="/categories">Categories</Link></li>
                </ul>
            </nav>
        </header>
    )
}

export default Header
