import Image from 'next/image'
import React from 'react'
import mdast from 'mdast'
import { normalizeUri, sanitizeUri } from 'micromark-util-sanitize-uri'
import type { InlineMath, Math as MathDirective } from 'mdast-util-math'
import { visit } from 'unist-util-visit'

import type { Alert, AlertKind } from '@/lib/markdown'
import MaterialIcon from './MaterialIcon'
import Math from './Math'
import Code from './Code'
import ColoredLink from './ColoredLink'

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
    math: MathDirective
    paragraph: mdast.Paragraph
    strong: mdast.Strong
    text: mdast.Text
    thematicBreak: mdast.ThematicBreak
    // custom directives
    alert: Alert,
}
type NodeType = keyof NodeTypeMap

const components: {
    [key in NodeType]: React.FC<{
        state: CompilerState
        node: NodeTypeMap[key]
    }>
} = {
    blockquote: ({ state, node }) => (
        <blockquote className='px-5 py-0.5 mx-6 my-10 border-l-4 border-orange-800 bg-orange-50'>
            { renderChildren(state, node) }
        </blockquote>
    ),

    break: () => <br />,

    code: ({ node }) => {
        if (node.lang === 'math') {
            /// ```math ... ``` は数式ブロックとして扱う
            return <Math displayMode>
                {node.value}
            </Math>
        }
        return (
            <Code
                lang={node.lang || undefined}
                title={node.meta || undefined}>
                {node.value}
            </Code>
        )
    },

    definition: () => undefined,

    delete: ({ state, node }) => (
        <del>
            { renderChildren(state, node) }
        </del>
    ),

    emphasis: ({ state, node }) => (
        <em>
            { renderChildren(state, node) }
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
            <ColoredLink href={`#${footnoteId}`}>
                {index + 1})
            </ColoredLink>
        </sup>
    },

    heading: ({ state, node }) => {
        if (node.depth === 1) {
            return <h1 className='text-3xl mt-5 mb-3'>
                { renderChildren(state, node) }
            </h1>
        }
        if (node.depth === 2) {
            return <h2 className='text-2xl mt-5 mb-3'>
                { renderChildren(state, node) }
            </h2>
        }
        if (node.depth === 3) {
            return <h3 className='text-xl mt-5 mb-3'>
                { renderChildren(state, node) }
            </h3>
        }
        if (node.depth === 4) {
            return <h4 className='text-xl mt-5 mb-3'>
                { renderChildren(state, node) }
            </h4>
        }
        if (node.depth === 5) {
            return <h5 className='text-xl mt-5 mb-3'>
                { renderChildren(state, node) }
            </h5>
        }
        if (node.depth === 6) {
            return <h6 className='text-xl mt-5 mb-3'>
                { renderChildren(state, node) }
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
        <Math>
            {node.value}
        </Math>
    ),

    link: ({ state, node }) => (
        <ColoredLink
            href={sanitizeUri(node?.url)}
            title={node.title || undefined}>
            { renderChildren(state, node) }
        </ColoredLink>
    ),

    linkReference: ({ state, node }) => {
        const ref = state.definitions.get(node.identifier)
        return <ColoredLink
            href={sanitizeUri(ref?.url)}
            title={ref?.title || undefined}>
            { renderChildren(state, node) }
        </ColoredLink>
    },

    list: ({ state, node }) => (
        node.ordered
            ? <ol className='my-6 list-outside pl-4 list-decimal'>{ renderChildren(state, node) }</ol>
            : <ul className='my-6 list-outside pl-4 list-disc'>{ renderChildren(state, node) }</ul>
    ),

    listItem: ({ state, node }) => (
        <li className='ml-6'>
            { renderChildren(state, node) }
        </li>
    ),

    math: ({ node }) => (
        <Math displayMode>
            {node.value}
        </Math>
    ),

    paragraph: ({ state, node }) => (
        <p className='my-6'>
            { renderChildren(state, node) }
        </p>
    ),

    strong: ({ state, node }) => (
        <strong className='text-red-400'>
            { renderChildren(state, node) }
        </strong>
    ),

    text: ({ node }) => node.value,

    thematicBreak: () => (
        <hr className='flex mx-auto w-20' />
    ),

    alert: ({ state, node }) => {
        const { icon, title } = alertStyles[node.kind]

        return <div className='px-5 py-3 my-10 border-l-4 border-orange-600 relative'>
            <div className='font-bold text-xl text-orange-600 my-0'>
                <MaterialIcon name={icon} />
                &nbsp;
                {title}
            </div>
            { renderChildren(state, node) }
        </div>
    },
}

const alertStyles: Record<AlertKind, { icon: string, title: string }> = {
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

const Node: React.FC<{
    state: CompilerState
    node: mdast.Node
}> = ({ state, node }) => {
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

const renderChildren = (state: CompilerState, { children }: mdast.Parent) => {
    return <> {
        children.map((child, i) => <Node state={state} node={child} key={i.toString()} />)
    } </>
}

const safeFootnoteId = (state: CompilerState, id: string) => {
    return `footnote-${normalizeUri(id.toLowerCase())}`
}

type CompilerState = {
    path?: string
    definitions: Map<string, mdast.Definition>,
    footnoteDefinitions: Map<string, mdast.FootnoteDefinition>,
    footnoteIdentifiers: string[],
}

// ---

const Footnotes: React.FC<{
    state: CompilerState
    footnotes: mdast.FootnoteDefinition[]
}> = ({ state, footnotes }) => (
    <section>
        <h2 className='text-2xl mt-5 mb-3'>Footnotes</h2>
        <ol className='list-outside pl-4 list-decimal'>
            { footnotes.map(node => {
                return <li
                    key={node.identifier}
                    id={`footnote-${node.identifier}`}
                    className='ml-6' >
                    { renderChildren(state, node) }
                </li>
            }) }
        </ol>
    </section>
)

// ----

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

    const body = renderChildren(state, content as mdast.Root)
    const footnotes = state.footnoteDefinitions.values().toArray()

    return (
        <article>
            {body}
            { footnotes.length > 0
                ? <Footnotes state={state} footnotes={footnotes} />
                : null }
        </article>
    )
}

export default Markdown
