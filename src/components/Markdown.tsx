import Image from 'next/image'
import React, { Fragment, ReactNode } from 'react'
import * as prod from 'react/jsx-runtime'
import katex from 'katex'
import * as unified from 'unified'
import mdast from 'mdast'
import { normalizeUri, sanitizeUri } from 'micromark-util-sanitize-uri'
import * as mdastDirective from 'mdast-util-directive'
import * as mdastMath from 'mdast-util-math'
import { visit } from 'unist-util-visit'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'
import * as shiki from 'shiki'

declare module 'unified' {
    interface CompileResultMap {
        ReactNode: ReactNode
    }
}

interface NodeTypeMap {
    blockquote: mdast.Blockquote
    break: mdast.Break
    code: mdast.Code
    containerDirective: mdastDirective.ContainerDirective
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
    leafDirective: mdastDirective.LeafDirective
    link: mdast.Link
    linkReference: mdast.LinkReference
    list: mdast.List
    listItem: mdast.ListItem
    math: mdastMath.Math
    paragraph: mdast.Paragraph
    strong: mdast.Strong
    text: mdast.Text
    textDirective: mdastDirective.TextDirective
    thematicBreak: mdast.ThematicBreak
}
type NodeType = keyof NodeTypeMap
type Emitter<N extends mdast.Node> = (args: { state: CompilerState, node: N, key?: string }) => React.ReactNode

const emitters: { [key in NodeType]: Emitter<NodeTypeMap[key]> } = {
    blockquote: ({ state, node, key }) => (
        <blockquote key={key} className='my-6'>
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
            const rendered = highlighter.codeToHtml(node.value, {
                lang: node.lang || 'txt',
                theme: 'vitesse-light',
            } satisfies shiki.CodeToHastOptions)
            return emitRawHtml(rendered, key)
        }
    },

    containerDirective: ({ state, node, key }) => {
        if (node.name !== 'callout') {
            return <div className='container-directive bg-blue-200' key={key} x-name={node.name}>
                { emitChildren({ state, node }) }
            </div>
        }
        return <div key={key} className='bg-orange-50 px-5 py-3 my-10 rounded relative'>
            { emitChildren({ state, node }) }
        </div>
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
        if (!ref) {
            return <code>[^{node.identifier}]</code>
        }

        const index = state.footnoteIdentifiers.indexOf(node.identifier)
        const footnoteId = safeFootnoteId(state, ref.identifier)

        return <sup key={key}>
            <a href={`#${footnoteId}`} className='no-underline text-orange-600 hover:underline'>
                {index + 1})
            </a>
        </sup>
    },

    heading: ({ state, node, key }) => {
        if (node.depth === 1) {
            return <h1 key={key} className='text-3xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h1>
        }
        if (node.depth === 2) {
            return <h2 key={key} className='text-2xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h2>
        }
        if (node.depth === 3) {
            return <h3 key={key} className='text-xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h3>
        }
        if (node.depth === 4) {
            return <h4 key={key} className='text-xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h4>
        }
        if (node.depth === 5) {
            return <h5 key={key} className='text-xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h5>
        }
        if (node.depth === 6) {
            return <h6 key={key} className='text-xl mt-5 mb-3'>
                { emitChildren({ state, node }) }
            </h6>
        }
    },

    html: ({ node, key }) => emitRawHtml(node.value, key),

    image: ({ node, key }) => (
        <Image
            src={sanitizeUri(node.url)}
            alt={node.alt || ''}
            title={node.title || undefined}
            width={480}
            height={320}
            key={key} />
    ),

    imageReference: ({ state, node, key }) => {
        const ref = state.definitions.get(node.identifier)
        return <Image
            src={sanitizeUri(ref?.url)}
            alt={node.alt || ''}
            title={ref?.title || undefined}
            width={480}
            height={320}
            key={key} />
    },

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

    leafDirective: ({ state, node, key }) => {
        return <div className='leaf-directive text-blue-400' x-name={node.name} key={key}>
            { emitChildren({ state, node }) }
        </div>
    },

    link: ({ state, node, key }) => (
        <a
            href={node.url}
            title={node.title || undefined}
            className='no-underline text-orange-600 hover:underline'
            key={key}>
            { emitChildren({ state, node }) }
        </a>
    ),

    linkReference: ({ state, node, key }) => {
        const ref = state.definitions.get(node.identifier)
        return <a
            key={key}
            href={sanitizeUri(ref?.url)}
            className='no-underline text-orange-600 hover:underline'>
            { emitChildren({ state, node }) }
        </a>
    },

    list: ({ state, node, key }) => (
        node.ordered
            ? <ol key={key} className='my-6 list-outside pl-4 list-decimal'>{ emitChildren({ state, node }) }</ol>
            : <ul key={key} className='my-6 list-outside pl-4 list-disc'>{ emitChildren({ state, node }) }</ul>
    ),

    listItem: ({ state, node, key }) => (
        <li key={key} className='ml-6'>
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
        <p key={key} className='my-6'>
            { emitChildren({ state, node }) }
        </p>
    ),

    strong: ({ state, node, key }) => (
        <strong className='text-red-400' key={key}>
            { emitChildren({ state, node }) }
        </strong>
    ),

    text: ({ node }) => node.value,

    textDirective: ({ state, node, key }) => {
        return <span className='text-directive font-bold text-blue-500' x-name={node.name} key={key}>
            { emitChildren({ state, node }) }
        </span>
    },

    thematicBreak: ({ key }) => (
        <hr key={key} className='flex mx-auto w-20' />
    ),
}

const emitRawHtml = (html: string, key?: string) => {
    const parsed = htmlConverter.processSync(html)
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

const safeFootnoteId = (state: CompilerState, id: string) => {
    return `footnote-${normalizeUri(id.toLowerCase())}`
}

const htmlConverter = unified.unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeReact, {
        Fragment: prod.Fragment,
        jsx: prod.jsx,
        jsxs: prod.jsxs,
    })
    .freeze()

const highlighter = await shiki.createHighlighter({
    langs: [
        'c',
        'css',
        'diff',
        'graphql',
        'html',
        'http',
        'rust',
        'shellsession',
        'toml',
        'yaml',
    ],
    langAlias: {
        'command': 'shellsession',
        'shell-session': 'shellsession',
    },
    themes: ['vitesse-light'],
})

type CompilerState = {
    definitions: Map<string, mdast.Definition>,
    footnoteDefinitions: Map<string, mdast.FootnoteDefinition>,
    footnoteIdentifiers: string[],
}

function remarkToJsx(this: unified.Processor) {
    this.compiler = (tree) => {
        const definitions = new Map()
        const footnoteDefinitions = new Map()
        visit(tree, (node) => {
            if (node.type === 'definition' || node.type === 'footnoteDefinition') {
                const id = (node as mdast.Definition | mdast.FootnoteDefinition).identifier
                const map = node.type === 'definition' ? definitions : footnoteDefinitions
                if (!map.has(id)) {
                    // id が重複する場合は先行する定義が優先される
                    map.set(id, node as never)
                }
            }
        })
        const footnoteIdentifiers = footnoteDefinitions.keys().toArray()

        const state: CompilerState = {
            definitions,
            footnoteDefinitions,
            footnoteIdentifiers,
        }

        const body = emitChildren({ state, node: tree as mdast.Root })
        
        const footnotes = state.footnoteDefinitions.values().toArray()
        const footer = footnotes.length > 0
            ? <section className='footnotes'>
                <h2 className='text-2xl mt-5 mb-3'>Footnotes</h2>
                <ol className='list-outside pl-4 list-decimal'>
                    { footnotes.map(node => {
                        return <li
                            key={node.identifier}
                            id={`footnote-${node.identifier}`}
                            className='ml-6' >
                            { emitChildren({ state, node }) }
                        </li>
                    }) }
                </ol>
            </section>
            : null

        return <article className='px-4 py-6'>
            {body}
            {footer}
        </article>
    }
}

// ---

const markdownProcessor = unified.unified()
    .use(remarkParse, { fragment: true })
    .use(remarkDirective)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkToJsx)
    .freeze()

export type Props = {
    children?: string
}

const Markdown: React.FC<Props> = async ({ children }) => {
    const parsed = await markdownProcessor.process(children)
    return <>
        {parsed.result}
    </>
}

export default Markdown
