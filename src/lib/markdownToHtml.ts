import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import rehypeKatex from 'rehype-katex'
import rehypeStringify from 'rehype-stringify'
import { Handlers } from 'mdast-util-to-hast'
import { Code } from 'mdast'
import { Element, Properties } from 'hast'

const markdownToHtml = async (rawContent: string) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
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
        .use(rehypeStringify)
        .process(rawContent)
    return parsed.toString()
}

export default markdownToHtml
