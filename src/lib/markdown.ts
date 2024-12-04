import  { unified, Processor } from 'unified'
import mdast, { Node } from 'mdast'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import { filter } from 'unist-util-filter'

declare module 'unified' {
    interface CompileResultMap {
        Node: Node
    }
}

export const parseMarkdown = async (content: string, filePath: string) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkExport, { filePath })
        .process(content)

    return parsed.result as mdast.Node
}

function remarkExport(this: Processor, { filePath }: { filePath?: string }) {
    this.compiler = (tree) => {
        const result = filter(tree, (node) => {
            if (node.type === 'html') {
                const html = node as mdast.Html
                if (!html.value.trimStart().startsWith('<!--')) {
                    console.warn(`${filePath}@${node.position?.start?.line} raw HTML detected. Ignored due to XSS prevention`)
                }
                return false
            }

            return true
        })

        if (!result) {
            throw Error("filtered mdast should not be empty")
        }

        return result
    }
}
