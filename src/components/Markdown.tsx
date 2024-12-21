import Image from 'next/image'
import React from 'react'
import mdast from 'mdast'
import { sanitizeUri } from 'micromark-util-sanitize-uri'
import type { InlineMath, Math as MathDirective } from 'mdast-util-math'

import type { Alert as AlertNode, Content, FootnoteReference } from '@/lib/markdown'
import Math from './Math'
import Code from './Code'
import ColoredLink from './ColoredLink'
import Alert from './Alert'

interface NodeTypeMap {
    blockquote: mdast.Blockquote
    break: mdast.Break
    code: mdast.Code
    delete: mdast.Delete
    emphasis: mdast.Emphasis
    footnoteReference: FootnoteReference
    heading: mdast.Heading
    image: mdast.Image
    inlineCode: mdast.InlineCode
    inlineMath: InlineMath
    link: mdast.Link
    list: mdast.List
    listItem: mdast.ListItem
    math: MathDirective
    paragraph: mdast.Paragraph
    strong: mdast.Strong
    text: mdast.Text
    thematicBreak: mdast.ThematicBreak
    // custom directives
    alert: AlertNode,
}
type NodeType = keyof NodeTypeMap

const components: {
    [key in NodeType]: React.FC<{ node: NodeTypeMap[key] }>
} = {
    blockquote: ({ node }) => (
        <blockquote className='px-5 py-0.5 mx-6 my-10 border-l-4 border-orange-800 bg-orange-50'>
            { renderChildren(node) }
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

    delete: ({ node }) => (
        <del>
            { renderChildren(node) }
        </del>
    ),

    emphasis: ({ node }) => (
        <em>
            { renderChildren(node) }
        </em>
    ),

    footnoteReference: ({ node }) => (
        <sup>
            <ColoredLink href={`#${node.identifier}`}>
                {node.label})
            </ColoredLink>
        </sup>
    ),

    heading: ({ node }) => {
        const Heading = (props: any) => (
            node.depth == 1 ? <h1 className='text-3xl mt-5 mb-3' {...props} />
                : node.depth == 2 ? <h2 className='text-2xl mt-5 mb-3'{...props} />
                : node.depth == 3 ? <h3 className='text-xl mt-5 mb-3' {...props} />
                : node.depth == 4 ? <h4 className='text-xl mt-5 mb-3' {...props} />
                : node.depth == 5 ? <h5 className='text-xl mt-5 mb-3' {...props} />
                : <h6 className='text-2xl mt-5 mb-3' {...props} />
        )
        return <Heading>
            { renderChildren(node) }
        </Heading>
    },

    image: ({ node }) => (
        <Image
            src={sanitizeUri(node.url)}
            alt={node.alt || ''}
            title={node.title || undefined}
            width={480}
            height={320} />
    ),

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

    link: ({ node }) => (
        <ColoredLink
            href={sanitizeUri(node?.url)}
            title={node.title || undefined}>
            { renderChildren(node) }
        </ColoredLink>
    ),

    list: ({ node }) => (
        node.ordered
            ? <ol className='my-6 list-outside pl-4 list-decimal'>{ renderChildren(node) }</ol>
            : <ul className='my-6 list-outside pl-4 list-disc'>{ renderChildren(node) }</ul>
    ),

    listItem: ({ node }) => (
        <li className='ml-6'>
            { renderChildren(node) }
        </li>
    ),

    math: ({ node }) => (
        <Math displayMode>
            {node.value}
        </Math>
    ),

    paragraph: ({ node }) => (
        <p className='my-6'>
            { renderChildren(node) }
        </p>
    ),

    strong: ({ node }) => (
        <strong>
            { renderChildren(node) }
        </strong>
    ),

    text: ({ node }) => node.value,

    thematicBreak: () => (
        <hr className='flex mx-auto w-20' />
    ),

    alert: ({ node }) => (
        <Alert kind={node.kind}>
            { renderChildren(node) }
        </Alert>
    ),
}

const Node: React.FC<{ node: mdast.Node }> = ({ node }) => {
    if (node.type in components) {
        return components[node.type as NodeType]({
            node: node as never,
        })
    }
    return <span className='bg-red-200 my-2'>
        {`unknown nodeType: ${node.type}`}
    </span>
}

const renderChildren = ({ children }: mdast.Parent) => {
    return <> {
        children.map((child, i) => <Node node={child} key={i.toString()} />)
    } </>
}

// ---

const Footnotes: React.FC<{
    footnotes: mdast.FootnoteDefinition[]
}> = ({ footnotes }) => (
    <section>
        <h2 className='text-2xl mt-5 mb-3'>Footnotes</h2>
        <ol className='list-outside pl-4 list-decimal'>
            { footnotes.map(node => {
                return <li
                    key={node.identifier}
                    id={`footnote-${node.identifier}`}
                    className='ml-6' >
                    { renderChildren(node) }
                </li>
            }) }
        </ol>
    </section>
)

// ----

export type Props = {
    content: Content
}

const Markdown: React.FC<Props> = async ({ content }) => {
    const body = renderChildren(content)

    return (
        <article>
            {body}
            { content.footnotes.length > 0
                ? <Footnotes footnotes={content.footnotes} />
                : null }
        </article>
    )
}

export default Markdown
