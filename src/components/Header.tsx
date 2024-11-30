'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import React from "react"
import { siteTitle } from '@/config'

const Header: React.FC = () => {
    const pathname = usePathname()
    const isRoot = pathname === '/'
    return (
        <header className='flex items-center justify-between py-2 bg-orange-800 text-orange-200'>
            <div className='px-2'>
                {isRoot ? null : <Link href="/">{siteTitle}</Link>}
            </div>
            <nav>
                <ul className='inline-flex items-center'>
                    <li className='px-2 md:px-4'><Link href="/tags">Tags</Link></li>
                    <li className='px-2 md:px-4'><Link href="/categories">Categories</Link></li>
                </ul>
            </nav>
        </header>
    )
}

export default Header
