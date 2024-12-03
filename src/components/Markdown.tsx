import Image from 'next/image'
import React, { Fragment, ReactNode } from 'react'
import * as prod from 'react/jsx-runtime'
import katex from 'katex'
import * as unified from 'unified'
import mdast from 'mdast'
import * as mdastMath from 'mdast-util-math'
import { visit } from 'unist-util-visit'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'

declare module 'unified' {
    interface CompileResultMap {
        ReactNode: ReactNode
    }
}

function remarkToJsx(this: unified.Processor) {
    type CompilerState = {
        definitions: Map<string, mdast.Definition>,
        footnoteDefinitions: Map<string, mdast.FootnoteDefinition>,
    }

    interface NodeTypeMap {
        blockquote: mdast.Blockquote
        break: mdast.Break
        code: mdast.Code
        definition: mdast.Definition
        delete: mdast.Delete
        emphasis: mdast.Emphasis
        footnoteDefinition: mdast.Definition
        footnoteReference: mdast.FootnoteReference
        heading: mdast.Heading
        html: mdast.Html
        image: mdast.Image
        imageReference: mdast.ImageReference
        inlineCode: mdast.InlineCode
        inlineMath: mdastMath.InlineMath
        link: mdast.Link
        linkReference: mdast.LinkReference
        list: mdast.List
        listItem: mdast.ListItem
        math: mdastMath.Math
        paragraph: mdast.Paragraph
        strong: mdast.Strong
        text: mdast.Text
        thematicBreak: mdast.ThematicBreak
    }
    type NodeType = keyof NodeTypeMap
    type Emitter<N extends mdast.Node> = (args: { state: CompilerState, node: N, key?: string }) => React.ReactNode

    const emitters: { [key in NodeType]: Emitter<NodeTypeMap[key]> } = {
        blockquote: ({ state, node, key }) => (
            <blockquote key={key}>
                { emitChildren({ state, node }) }
            </blockquote>
        ),

        break: ({ key }) => <br key={key} />,

        code: ({ node, key }) => {
            if (node.lang === 'math') {
                const rendered = katex.renderToString(node.value, {
                    displayMode: true
                })
                return emitRawHtml(rendered, key)
            } else {
                // TODO: code highlighting
                return <pre key={key} className={`lang-${node.lang}`} title={node.meta || undefined}>
                    <code>
                        {node.value}
                    </code>
                </pre>
            }
        },

        definition: () => undefined,

        delete: ({ state, node, key }) => (
            <del key={key}>
                { emitChildren({ state, node }) }
            </del>
        ),

        emphasis: ({ state, node, key }) => (
            <em key={key}>
                { emitChildren({ state, node }) }
            </em>
        ),

        footnoteDefinition: () => undefined,

        footnoteReference: ({ state, node, key }) => {
            const ref = state.footnoteDefinitions.get(node.identifier)
            return <sup key={key}>
                <a href={`#footnote-${ref?.identifier}`}>
                    {ref?.label || "footnote"}
                </a>
            </sup>
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

        html: ({ node, key }) => emitRawHtml(node.value, key),

        image: ({ node, key }) => (
            <Image
                src={node.url}                
                alt={node.alt || node.url}
                title={node.title || undefined}
                key={key} />
        ),

        imageReference: ({ node, key }) => (
            <span
                key={key}
                x-identifier={node.identifier}
                x-label={node.label}
                x-reference-type={node.referenceType}
                x-alt={node.alt}
                className='text-red-500 underline' />
        ),

        inlineCode: ({ node, key }) => (
            <code key={key}>
                {node.value}
            </code>
        ),

        inlineMath: ({ node, key }) => {
            const rendered = katex.renderToString(node.value, {
                displayMode: false,
            })
            return emitRawHtml(rendered, key)
        },

        link: ({ state, node, key }) => (
            <a
                href={node.url}
                title={node.title || undefined}
                key={key}>
                { emitChildren({ state, node }) }
            </a>
        ),

        linkReference: ({ state, node, key }) => {
            const ref = state.definitions.get(node.identifier)
            return <a
                key={key}
                href={ref?.url}>
                { emitChildren({ state, node }) }
            </a>
        },

        list: ({ state, node, key }) => (
            node.ordered
                ? <ol key={key}>{ emitChildren({ state, node }) }</ol>
                : <ul key={key}>{ emitChildren({ state, node }) }</ul>
        ),

        listItem: ({ state, node, key }) => (
            <li key={key}>
                { emitChildren({ state, node }) }
            </li>
        ),

        math: ({ node, key }) => {
            const rendered = katex.renderToString(node.value, {
                displayMode: true,
            })
            return emitRawHtml(rendered, key)
        },

        paragraph: ({ state, node, key }) => (
            <p key={key}>
                { emitChildren({ state, node }) }
            </p>
        ),

        strong: ({ state, node, key }) => (
            <strong className='text-red-400' key={key}>
                { emitChildren({ state, node }) }
            </strong>
        ),

        text: ({ node }) => node.value,

        thematicBreak: ({ key }) => <hr key={key} />,
    }

    const emitRawHtml = (html: string, key?: string) => {
        const parsed = unified.unified()
            .use(rehypeParse, { fragment: true })
            .use(rehypeReact, {
                Fragment: prod.Fragment,
                jsx: prod.jsx,
                jsxs: prod.jsxs,
            })
            .processSync(html)
        return <Fragment key={key}>
            {parsed.result}
        </Fragment>
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

    this.compiler = (tree) => {
        const state: CompilerState = {
            definitions: new Map(),
            footnoteDefinitions: new Map(),
        }

        visit(tree, (node) => {
            if (node.type === 'definition') {
                const def = node as mdast.Definition
                state.definitions.set(def.identifier, def)
            }

            if (node.type === 'footnoteDefinition') {
                const def = node as mdast.FootnoteDefinition
                state.footnoteDefinitions.set(def.identifier, def)
            }
        })
        const body = emitChildren({ state, node: tree as mdast.Root })
        const footnotes = Array.from(state.footnoteDefinitions.values())
        return <article className='px-4 py-6 prose'>
            {body}
            <section className='footnotes'>
                <ol>
                    { footnotes.map(node => {
                        return <li key={node.identifier} id={`footnote-${node.identifier}`}>
                            { emitChildren({ state, node }) }
                        </li>
                    }) }
                </ol>
            </section>
        </article>
    }
}

// ---

export type Props = {
    children?: string
}

const Markdown: React.FC<Props> = async ({ children }) => {
    const parsed = await unified.unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkToJsx)
        .process(children)
    return <>
        {parsed.result}
    </>
}

export default Markdown
