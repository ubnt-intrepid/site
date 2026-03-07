import { Metadata } from 'next'
import React, { ReactNode } from 'react'
import Header from '@/components/Header'
import { authorName, authorUrl, baseUrl, siteDescription, siteTitle } from '@/config'

import './styles.css'

export const metadata: Metadata = {
    title: {
        template: `%s - ${siteTitle}`,
        default: siteTitle,
    },
    description: siteDescription,
    authors: [
        { name: authorName, url: authorUrl }
    ],
    openGraph: {
        type: "website",
        url: baseUrl,
        images: `${baseUrl}/image.png`,
    },
}

const RootLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <html lang="ja">
            <head>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/icon?family=Material+Icons" />
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/npm/katex@0.16.28/dist/katex.min.css"
                    integrity="sha384-Wsr4Nh3yrvMf2KCebJchRJoVo1gTU6kcP05uRSh5NV3sj9+a8IomuJoQzf3sMq4T"
                    crossOrigin="anonymous" />
            </head>
            <body className='flex flex-col min-h-screen bg-page-bg text-body-text'>
                <Header />
                <main className='flex-grow'>
                    {children}
                </main>
                <footer className='bg-footer-bg text-footer-text'>
                    <p className='text-center text-xs p-2'>
                        &copy; 2019-{new Date().getFullYear()} <strong><a href={authorUrl}>{authorName}</a></strong>
                    </p>
                </footer>
            </body>
        </html>
    )
}

export default RootLayout
