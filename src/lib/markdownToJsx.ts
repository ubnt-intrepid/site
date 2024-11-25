import * as prod from 'react/jsx-runtime'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeReact from 'rehype-react'
import { Handlers } from 'mdast-util-to-hast'
import { Code } from 'mdast'
import { Element, Properties } from 'hast'
import { h } from 'hastscript'
import { visit } from 'unist-util-visit'

const remarkCalloutDirectives = () => {
    return (tree: any) => {
        visit(tree, (node) => {
            if (
                node.type !== 'containerDirective' &&
                node.type !== 'leafDirective' &&
                node.type !== 'textDirective'
            ) {
                return
            }

            if (node.name !== 'callout') {
                return
            }

            const data = node.data || (node.data = {})
            const tagName = node.type === 'textDirective' ? 'span' : 'div'

            const attributes = node.attributes || {}
            const className = attributes.className || (attributes.className = [])
            className.push('callout')

            data.hName = tagName
            data.hProperties = h(tagName, attributes).properties
        })
    }
}

const markdownToJsx = async (rawContent: string) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkCalloutDirectives)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkRehype, {
            allowDangerousHtml: true,
            handlers: {
                code: (state, node: Code) => {
                    const value = node.value ? node.value + '\n' : ''
                    const properties: Properties = {}
                    
                    if (node.lang) {
                        properties.className = ['language-' + node.lang]
                    }

                    let codeResult: Element = {
                        type: 'element',
                        tagName: 'code',
                        properties,
                        children: [{ type: 'text', value }]
                    }
                    state.patch(node, codeResult)
                    codeResult = state.applyData(node, codeResult)

                    let title: Element | null = null
                    if (node.meta) {
                        title = {
                            type: 'element',
                            tagName: 'span',
                            properties: {
                                className: ['title'],
                            },
                            children: [{ type: 'text', value: node.meta }]
                        }
                    }

                    const preResult: Element = {
                        type: 'element',
                        tagName: 'pre',
                        properties: {},
                        children: [codeResult],
                    }

                    const result: Element = {
                        type: 'element',
                        tagName: 'div',
                        properties: {
                            className: ['code-block'],
                        },
                        children: title ? [title, preResult] : [preResult],
                    }
                    if (node.meta) {
                        result.data = { meta: node.meta }
                    }
                    state.patch(node, result)
                    return state.applyData(node, result)
                }
            } as Handlers
        })
        .use(rehypeRaw)
        .use(rehypeHighlight)
        .use(rehypeKatex)
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs
        })
        .process(rawContent)
    return parsed.result
}

export default markdownToJsx
