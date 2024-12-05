import assert from 'node:assert/strict'
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
    content: mdast.Root,
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
        const result = filter(tree, (node) => {
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

        if (!result) {
            assert.fail('filtered mdast should not be empty')
        }

        if (result.type !== 'root') {
            assert.fail('the root node must be mdast.Root')
        }

        return {
            matter: matter ?? "",
            content: result as mdast.Root,
        } satisfies ParseResult as ParseResult
    }
}
