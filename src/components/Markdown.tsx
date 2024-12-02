import React from 'react'
import * as unified from 'unified'
import mdast from 'mdast'
import * as mdastMath from 'mdast-util-math'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { inspect } from 'unist-util-inspect'

declare module 'unified' {
    interface CompileResultMap {
        JsxResult: JsxResult
    }
}

type JsxResult = {
    raw: mdast.Node
    jsx: string | React.JSX.Element
}

function remarkToJsx(this: unified.Processor) {
    type CompilerState = {}

    interface NodeTypeMap {
        root: mdast.Root
        text: mdast.Text
        paragraph: mdast.Paragraph
        heading: mdast.Heading
        link: mdast.Link
        inlineCode: mdast.InlineCode
        code: mdast.Code
        inlineMath: mdastMath.InlineMath
        math: mdastMath.Math
    }
    type NodeType = keyof NodeTypeMap
    type Emitter<N extends mdast.Node> = (state: CompilerState, node: N) => string | React.JSX.Element

    const emitters: { [key in NodeType]: Emitter<NodeTypeMap[key]> } = {
        root: (state, node) => {
            return <div className='root'>
                { node.children.map(child => emitOne(state, child)) }
            </div>
        },

        text: (state, node) => {
            return node.value
        },

        paragraph: (state, node) => {
            return <p>
                { node.children.map(child => emitOne(state, child)) }
            </p>
        },
    
        heading: (state, node) => {
            return <div className='heading' x-depth={node.depth}>
                { node.children.map(child => emitOne(state, child)) }
            </div>
        },
    
        link: (state, node) => {
            return <span className='link' x-title={node.title} x-url={node.url}>
                { node.children.map(child => emitOne(state, child)) }
            </span>
        },
    
        inlineCode: (state, node) => {
            return <code>{node.value}</code>
        },
    
        code: (state, node) => {
            return <pre x-lang={node.lang} x-meta={node.meta}>
                <code>
                    {node.value}
                </code>
            </pre>
        },
    
        inlineMath: (state, node) => {
            return <code className='inline-math'>{node.value}</code>
        },
    
        math: (state, node) => {
            return <pre x-lang='math' x-meta={node.meta}>
                <code>
                    {node.value}
                </code>
            </pre>        
        }    
    }

    const emitOne: Emitter<mdast.Node> = (state, node) => {
        if (node.type in emitters) {
            return emitters[node.type as NodeType](state, node as never)
        }
        return (
            <details>
                <summary className='bg-red-500'>unimplemented</summary>
                <pre className='overflow-x-auto'>
                    <code>
                        {inspect(node, { color: false, showPositions: false })}
                    </code>
                </pre>
            </details>
        )    
    }

    this.compiler = (tree, file) => {
        const state: CompilerState = {}
        const compiled = emitOne(state, tree)
        return {
            raw: tree,
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
    const { raw, jsx } = parsed.result as JsxResult
    return (
        <article className='px-4 py-6'>
            <details>
                <summary className='bg-blue-200'>Raw MdAst</summary>
                <pre className='overflow-x-auto'>
                    <code>
                        {inspect(raw, { color: false, showPositions: false })}
                    </code>
                </pre>
            </details>
            {jsx}
        </article>
    )
}

export default Markdown
