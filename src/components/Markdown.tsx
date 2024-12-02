import React from 'react'
import * as unified from 'unified'
import remarkParse from 'remark-parse'
import remarkDirective from 'remark-directive'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { inspect } from 'unist-util-inspect'


function remarkToJsx(this: unified.Processor) {
    this.compiler = (tree, file) => {
        return inspect(tree, { color: false, showPositions: false })
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
    return (
        <article className='px-4 py-6'>
            <pre className='overflow-x-auto'>
                <code>
                    {parsed.toString()}
                </code>
            </pre>
        </article>
    )
}

export default Markdown
