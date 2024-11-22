import { Metadata } from 'next'
import React, { ReactNode } from 'react'
import Header from './components/Header'
import { authorName, authorUrl, siteTitle } from '../src/consts'

import '@fortawesome/fontawesome-free/css/all.css'
import 'highlight.js/styles/atom-one-light.css'
import './styles.scss'

export const metadata: Metadata = {
    title: {
        template: `%s - ${siteTitle}`,
        default: siteTitle,
    }
}

const RootLayout: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <html lang="ja">
            <head>
                <link
                    rel="stylesheet"
                    href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css"
                    integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+"
                    crossOrigin="anonymous" />
            </head>
            <body>
                <div className="flex flex-col min-h-screen">
                    <Header />

                    {children}

                    <footer className="bg-gray-200">
                        <p className="text-center text-xs p-2">
                            &copy; 2019-2024 <strong>
                                <a href={authorUrl}>{authorName}</a>
                            </strong>
                        </p>
                    </footer>
                </div>
            </body>
        </html>
    )
}

export default RootLayout
