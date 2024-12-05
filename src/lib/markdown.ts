import  { unified, Processor } from 'unified'
import mdast from 'mdast'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'
import { filter } from 'unist-util-filter'

declare module 'unified' {
    interface CompileResultMap {
        ParseResult: ParseResult
    }
}

type ParseResult = {
    matter: string
    node: mdast.Node,
}

export const parseMarkdown = async (content: string, filePath: string) => {
    const parsed = await unified()
        .use(remarkParse, { fragment: true })
        .use(remarkFrontmatter)
        .use(remarkDirective)
        .use(remarkGfm)
        .use(remarkMath)
        .use(remarkExport, { filePath })
        .process(content)

    return parsed.result as ParseResult
}

function remarkExport(this: Processor, { filePath }: { filePath?: string }) {
    this.compiler = (tree) => {
        let matter: string | null = null
        const node = filter(tree, (node) => {
            if (node.type === 'yaml') {
                // front matter
                matter = (node as mdast.Yaml).value
                return false
            }

            if (node.type === 'html') {
                // raw HTML
                const html = node as mdast.Html
                if (!html.value.trimStart().startsWith('<!--')) {
                    console.warn(`${filePath}@${node.position?.start?.line} raw HTML detected. Ignored due to XSS prevention`)
                }
                return false
            }

            return true
        })

        if (!node) {
            throw Error("filtered mdast should not be empty")
        }

        return {
            matter: matter ?? "",
            node
        } satisfies ParseResult as ParseResult
    }
}