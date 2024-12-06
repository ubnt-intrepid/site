import React from 'react'
import * as prod from 'react/jsx-runtime'
import katex from 'katex'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'

const Math: React.FC<{
    displayMode?: boolean
    children?: string
}> = async ({ children, displayMode }) => {
    const rendered = katex.renderToString(children ?? '', { displayMode })
    const parsed = await unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
        })
        .process(rendered)
        return <>
            {parsed.result}
        </>
}

export default Math
