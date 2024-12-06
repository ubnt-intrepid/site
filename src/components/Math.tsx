import React from 'react'
import * as prod from 'react/jsx-runtime'
import { fromHtml } from 'hast-util-from-html'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import katex from 'katex'

const Math: React.FC<{
    displayMode?: boolean
    children?: string
}> = ({ children, displayMode }) => {
    const html = katex.renderToString(children ?? '', { displayMode })
    const hast = fromHtml(html, { fragment: true })
    return toJsxRuntime(hast, {
        Fragment: prod.Fragment,
        jsx: prod.jsx,
        jsxs: prod.jsxs,
    })
}

export default Math
