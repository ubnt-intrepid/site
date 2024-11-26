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
                    href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
                    integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+"
                    crossOrigin="anonymous" />
            </head>
            <body>
                <Header />
                <main>
                    {children}
                </main>
                <footer>
                    <p>&copy; 2019-2024 <strong><a href={authorUrl}>{authorName}</a></strong></p>
                </footer>
            </body>
        </html>
    )
}

export default RootLayout
