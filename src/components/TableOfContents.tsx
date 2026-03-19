import React from 'react'
import type { HeadingItem } from '@/lib/markdown'

const TableOfContents: React.FC<{ headings: HeadingItem[] }> = ({ headings }) => {
    if (headings.length === 0) return null

    const minDepth = Math.min(...headings.map(h => h.depth))

    return (
        <nav className='sticky top-8 text-sm'>
            <p className='font-semibold mb-3'>目次</p>
            <ol className='space-y-2'>
                {headings.map((h, i) => (
                    <li
                        key={i}
                        style={{ paddingLeft: `${(h.depth - minDepth) * 0.75}rem` }}>
                        <a
                            href={`#${h.id}`}
                            className='text-accent-dark hover:underline leading-snug block'>
                            {h.text}
                        </a>
                    </li>
                ))}
            </ol>
        </nav>
    )
}

export default TableOfContents
