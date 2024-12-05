import Image from 'next/image'
import React from 'react'
import * as prod from 'react/jsx-runtime'
import katex from 'katex'
import { unified } from 'unified'
import mdast from 'mdast'
import { normalizeUri, sanitizeUri } from 'micromark-util-sanitize-uri'
import type { InlineMath, Math } from 'mdast-util-math'
import { visit } from 'unist-util-visit'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'
import * as shiki from 'shiki'

import type { UserCallout } from '@/lib/markdown'
import MaterialIcon from './MaterialIcon'

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
    image: mdast.Image
    imageReference: mdast.ImageReference
    inlineCode: mdast.InlineCode
    inlineMath: InlineMath
    link: mdast.Link
    linkReference: mdast.LinkReference
    list: mdast.List
    listItem: mdast.ListItem
    math: Math
    paragraph: mdast.Paragraph
    strong: mdast.Strong
    text: mdast.Text
    thematicBreak: mdast.ThematicBreak
    // custom directives
    userCallout: UserCallout,
}
type NodeType = keyof NodeTypeMap
type NodeComponent<N extends mdast.Node> = React.FC<{ state: CompilerState, node: N }>

const components: { [key in NodeType]: NodeComponent<NodeTypeMap[key]> } = {
    blockquote: ({ state, node }) => (
        <blockquote className='px-5 py-0.5 mx-6 my-10 border-l-4 border-orange-800 bg-orange-50'>
            { emitChildren(state, node) }
        </blockquote>
    ),

    break: () => <br />,

    code: ({ node }) => {
        if (node.lang === 'math') {
            /// ```math ... ``` は数式ブロックとして扱う
            return <Math displayMode={true}>
                {node.value}
            </Math>
        }

        const rendered = highlighter.codeToHtml(node.value, {
            lang: node.lang || 'txt',
            theme: 'vitesse-light',
        } satisfies shiki.CodeToHastOptions)

        const title = node.meta
        const codeBlock = unified()
            .use(rehypeParse, { fragment: true })
            .use(rehypeReact, {
                Fragment: prod.Fragment,
                jsx: prod.jsx,
                jsxs: prod.jsxs,
                components: {
                    pre: (props) => {
                        const addedClasses = 'm-0 px-5 py-3 border-2 border-solid border-slate-300 rounded-b-md rounded-tr-md whitespace-pre-wrap'
                        const className = props.className ? `${props.className} ${addedClasses}` : addedClasses
                        return <pre {...props} className={className} />
                    }
                }
            })
            .processSync(rendered)
            .result

        return <div className='my-6'>
            { title ? <span className='inline-block px-2 py-1 -mb-px rounded-t-sm
                text-sm font-mono font-bold
                bg-orange-600 text-orange-5'>{title}</span> : null }
            {codeBlock}
        </div>
    },

    definition: () => undefined,

    delete: ({ state, node }) => (
        <del>
            { emitChildren(state, node) }
        </del>
    ),

    emphasis: ({ state, node }) => (
        <em>
            { emitChildren(state, node) }
        </em>
    ),

    footnoteDefinition: () => undefined,

    footnoteReference: ({ state, node }) => {
        const ref = state.footnoteDefinitions.get(node.identifier)
        if (!ref) {
            return <code>[^{node.identifier}]</code>
        }

        const index = state.footnoteIdentifiers.indexOf(node.identifier)
        const footnoteId = safeFootnoteId(state, ref.identifier)

        return <sup>
            <a href={`#${footnoteId}`} className='no-underline text-orange-600 hover:underline'>
                {index + 1})
            </a>
        </sup>
    },

    heading: ({ state, node }) => {
        if (node.depth === 1) {
            return <h1 className='text-3xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h1>
        }
        if (node.depth === 2) {
            return <h2 className='text-2xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h2>
        }
        if (node.depth === 3) {
            return <h3 className='text-xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h3>
        }
        if (node.depth === 4) {
            return <h4 className='text-xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h4>
        }
        if (node.depth === 5) {
            return <h5 className='text-xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h5>
        }
        if (node.depth === 6) {
            return <h6 className='text-xl mt-5 mb-3'>
                { emitChildren(state, node) }
            </h6>
        }
    },

    image: ({ node }) => (
        <Image
            src={sanitizeUri(node.url)}
            alt={node.alt || ''}
            title={node.title || undefined}
            width={480}
            height={320} />
    ),

    imageReference: ({ state, node }) => {
        const ref = state.definitions.get(node.identifier)
        return <Image
            src={sanitizeUri(ref?.url)}
            alt={node.alt || ''}
            title={ref?.title || undefined}
            width={480}
            height={320} />
    },

    inlineCode: ({ node }) => (
        <code>
            {node.value}
        </code>
    ),

    inlineMath: ({ node }) => (
        <Math displayMode={false}>
            {node.value}
        </Math>
    ),

    link: ({ state, node }) => (
        <a
            href={node.url}
            title={node.title || undefined}
            className='no-underline text-orange-600 hover:underline'>
            { emitChildren(state, node) }
        </a>
    ),

    linkReference: ({ state, node }) => {
        const ref = state.definitions.get(node.identifier)
        return <a
            href={sanitizeUri(ref?.url)}
            className='no-underline text-orange-600 hover:underline'>
            { emitChildren(state, node) }
        </a>
    },

    list: ({ state, node }) => (
        node.ordered
            ? <ol className='my-6 list-outside pl-4 list-decimal'>{ emitChildren(state, node) }</ol>
            : <ul className='my-6 list-outside pl-4 list-disc'>{ emitChildren(state, node) }</ul>
    ),

    listItem: ({ state, node }) => (
        <li className='ml-6'>
            { emitChildren(state, node) }
        </li>
    ),

    math: ({ node }) => (
        <Math displayMode={true}>
            {node.value}
        </Math>
    ),

    paragraph: ({ state, node }) => (
        <p className='my-6'>
            { emitChildren(state, node) }
        </p>
    ),

    strong: ({ state, node }) => (
        <strong className='text-red-400'>
            { emitChildren(state, node) }
        </strong>
    ),

    text: ({ node }) => node.value,

    thematicBreak: () => (
        <hr className='flex mx-auto w-20' />
    ),

    userCallout: ({ state, node }) => {
        const { icon, title } = calloutStyles[node.kind]

        return <div className='px-5 py-3 my-10 border-l-4 border-orange-600 relative'>
            <div className='font-bold text-xl text-orange-600 my-0'>
                <MaterialIcon name={icon} />
                &nbsp;
                {title}
            </div>
            { emitChildren(state, node) }
        </div>
    },
}

const calloutStyles: Record<string, { icon: string, title: string }> = {
    'note': {
        icon: 'error',
        title: 'Note'
    },
    'tip': {
        icon: 'lightbulb',
        title: 'Tip'
    },
    'important': {
        icon: 'warning',
        title: 'Important'
    },
    'warning': {
        icon: 'warning',
        title: 'Warning'
    },
    'caution': {
        icon: 'error',
        title: 'Caution'
    }
}

const Node: NodeComponent<mdast.Node> = ({ state, node }) => {
    if (node.type in components) {
        return components[node.type as NodeType]({
            state,
            node: node as never,
        })
    }
    return <span className='bg-red-200 my-2'>
        {`unknown nodeType: ${node.type}`}
    </span>
}

const Math: React.FC<{
    displayMode: boolean
    children: string
}> = ({ children, displayMode }) => {
    const rendered = katex.renderToString(children, { displayMode })
    const parsed = unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
        })
        .processSync(rendered)
        return <>
            {parsed.result}
        </>
}

const emitChildren = (state: CompilerState, { children }: mdast.Parent) => {
    return <> {
        children.map((child, i) => <Node state={state} node={child} key={i.toString()} />)
    } </>
}

const safeFootnoteId = (state: CompilerState, id: string) => {
    return `footnote-${normalizeUri(id.toLowerCase())}`
}

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
    path?: string
    definitions: Map<string, mdast.Definition>,
    footnoteDefinitions: Map<string, mdast.FootnoteDefinition>,
    footnoteIdentifiers: string[],
}

// ---

export type Props = {
    path?: string
    content: mdast.Node
}

const Markdown: React.FC<Props> = async ({ path, content }) => {
    const definitions = new Map()
    const footnoteDefinitions = new Map()
    visit(content, (node) => {
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
        path,
        definitions,
        footnoteDefinitions,
        footnoteIdentifiers,
    }

    const body = emitChildren(state, content as mdast.Root)

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
                        { emitChildren(state, node) }
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

export default Markdown
