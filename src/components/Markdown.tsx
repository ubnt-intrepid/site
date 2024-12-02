import React, { Fragment } from 'react'
import * as prod from 'react/jsx-runtime'
import * as unified from 'unified'
import mdast from 'mdast'
import * as mdastMath from 'mdast-util-math'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'

declare module 'unified' {
    interface CompileResultMap {
        JsxResult: JsxResult
    }
}

type JsxResult = {
    jsx: React.ReactNode
}

function remarkToJsx(this: unified.Processor) {
    type CompilerState = {}

    interface NodeTypeMap {
        root: mdast.Root
        text: mdast.Text
        paragraph: mdast.Paragraph
        heading: mdast.Heading
        blockquote: mdast.Blockquote
        list: mdast.List
        listItem: mdast.ListItem
        link: mdast.Link
        linkReference: mdast.LinkReference
        footnoteReference: mdast.FootnoteReference
        inlineCode: mdast.InlineCode
        code: mdast.Code
        inlineMath: mdastMath.InlineMath
        math: mdastMath.Math
        html: mdast.Html
        thematicBreak: mdast.ThematicBreak
        strong: mdast.Strong
        delete: mdast.Delete
        break: mdast.Break
        emphasis: mdast.Emphasis
        image: mdast.Image
        imageReference: mdast.ImageReference
        definition: mdast.Definition
        footnoteDefinition: mdast.Definition
    }
    type NodeType = keyof NodeTypeMap
    type Emitter<N extends mdast.Node> = (args: { state: CompilerState, node: N, key?: string }) => React.ReactNode

    const emitters: { [key in NodeType]: Emitter<NodeTypeMap[key]> } = {
        root: ({ state, node }) => {
            return emitChildren({ state, node })
        },

        text: ({ node }) => {
            return node.value
        },

        paragraph: ({ state, node, key }) => {
            return <p key={key}>
                { emitChildren({ state, node }) }
            </p>
        },

        heading: ({ state, node, key }) => {
            if (node.depth === 1) {
                return <h1 key={key}>{ emitChildren({ state, node }) }</h1>
            }
            if (node.depth === 2) {
                return <h2 key={key}>{ emitChildren({ state, node }) }</h2>
            }
            if (node.depth === 3) {
                return <h3 key={key}>{ emitChildren({ state, node }) }</h3>
            }
            if (node.depth === 4) {
                return <h4 key={key}>{ emitChildren({ state, node }) }</h4>
            }
            if (node.depth === 5) {
                return <h5 key={key}>{ emitChildren({ state, node }) }</h5>
            }
            if (node.depth === 6) {
                return <h6 key={key}>{ emitChildren({ state, node }) }</h6>
            }
        },

        blockquote: ({ state, node, key }) => {
            return <blockquote key={key}>
                { emitChildren({ state, node }) }
            </blockquote>
        },

        list: ({ state, node, key }) => {
            if (node.ordered) {
                return <ol key={key}>
                    { emitChildren({ state, node }) }
                </ol>
            } else {
                return <ul key={key}>
                    { emitChildren({ state, node }) }
                </ul>
            }
        },

        listItem: ({ state, node, key }) => {
            return <li key={key}>
                { emitChildren({ state, node }) }
            </li>
        },

        link: ({ state, node, key }) => {
            return <a href={node.url} title={node.title || undefined} key={key}>
                { emitChildren({ state, node }) }
            </a>
        },

        linkReference: ({ state, node, key }) => {
            return <span key={key} x-identifier={node.identifier} x-label={node.label} x-reference-type={node.referenceType} className='text-red-500 underline'>
                { emitChildren({ state, node }) }                
            </span>
        },

        footnoteReference: ({ state, node, key }) => {
            return <sup key={key}>
                <span key={key} x-identifier={node.identifier} x-label={node.label} className='text-red-500 underline'>
                    f
                </span>
            </sup>
        },

        inlineCode: ({ node, key }) => {
            return <code key={key}>{node.value}</code>
        },

        code: ({ node, key }) => {
            return <pre x-lang={node.lang} x-meta={node.meta} key={key}>
                <code>
                    {node.value}
                </code>
            </pre>
        },

        inlineMath: ({ node, key }) => {
            return <code className='inline-math' key={key}>{node.value}</code>
        },

        math: ({ node, key }) => {
            return <pre x-lang='math' x-meta={node.meta} key={key}>
                <code>
                    {node.value}
                </code>
            </pre>
        },

        html: ({ node, key }) => {
            const parsed = unified.unified()
                .use(rehypeParse, { fragment: true })
                .use(rehypeReact, {
                    Fragment: prod.Fragment,
                    jsx: prod.jsx,
                    jsxs: prod.jsxs,    
                })
                .processSync(node.value)
            return <Fragment key={key}>
                {parsed.result}
            </Fragment>
        },

        thematicBreak: ({ key }) => {
            return <hr key={key} />
        },

        strong: ({ state, node, key }) => {
            return <strong className='text-red-400' key={key}>
                { emitChildren({ state, node }) }
            </strong>
        },

        delete: ({ state, node, key }) => {
            return <del key={key}>
                { emitChildren({ state, node }) }
            </del>
        },

        break: ({ key }) => <br key={key} />,

        emphasis: ({ state, node, key }) => {
            return <em key={key}>
                { emitChildren({ state, node }) }
            </em>
        },

        image: ({ node, key }) => {
            return <img src={node.url} alt={node.alt || undefined} title={node.title || undefined} key={key} />
        },

        imageReference: ({ node, key }) => {
            return <span key={key} x-identifier={node.identifier} x-label={node.label} x-reference-type={node.referenceType} x-alt={node.alt} className='text-red-500 underline' />
        },

        definition: () => undefined,
        footnoteDefinition: () => undefined,
    }

    const emitOne: Emitter<mdast.Node> = ({ state, node, key }) => {
        if (node.type in emitters) {
            return emitters[node.type as NodeType]({
                state,
                node: node as never,
                key
            })
        }
        return <span className='bg-red-200 my-2' key={key}>
            {`unknown nodeType: ${node.type}`}
        </span>
    }

    const emitChildren: Emitter<mdast.Parent> = ({ state, node: parent }) => {
        let keyCount = 0
        return <>
            { parent.children.map(child => {
                const key = `${child.type}-${keyCount}`
                keyCount += 1
                return emitOne({ state, node: child, key })
            }) }
        </>
    }

    this.compiler = (tree, file) => {
        const state: CompilerState = {}
        const compiled = emitters['root']({ state, node: tree as mdast.Root })
        return {
            jsx: compiled
        } satisfies JsxResult as JsxResult
    }
}

// ---

export type Props = {
    content?: string
}

const Markdown: React.FC<Props> = async ({ content }) => {
    const parsed = await unified.unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkToJsx)
        .process(content)
    const { jsx } = parsed.result as JsxResult
    return (
        <article className='px-4 py-6 prose'>
            {jsx}
        </article>
    )
}

export default Markdown
