import * as prod from 'react/jsx-runtime'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypeReact, { Components } from 'rehype-react'
import { Handlers, State } from 'mdast-util-to-hast'
import { Code } from 'mdast'
import { Element } from 'hast'
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

const mdCodeBlockHandler = (state: State, node: Code) => {
    let result: Element = {
        type: 'element',
        tagName: 'my-code-block',
        properties: {
            lang: node.lang,
            title: node.meta,
            content: node.value ? node.value + '\n' : '',
        },
        children: [],
    }
    state.patch(node, result)
    result = state.applyData(node, result)

    return result
}

const markdownToJsx = async (content: string, codeBlockComponent: any) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkCalloutDirectives)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkRehype, {
            allowDangerousHtml: true,
            handlers: { code: mdCodeBlockHandler } as Handlers
        })
        .use(rehypeRaw)
        .use(rehypeKatex)
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
            components: {
                'my-code-block': (props: any) => codeBlockComponent(props),
            } as Partial<Components>,
        })
        .process(content)
    return parsed.result
}

export default markdownToJsx
