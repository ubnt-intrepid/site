import assert from 'node:assert/strict'
import  { unified, Processor } from 'unified'
import type mdast from 'mdast'
import type { ContainerDirective } from 'mdast-util-directive'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'

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

export interface UserCallout extends mdast.Parent {
    type: 'userCallout'
    kind: string
    children: Array<mdast.BlockContent | mdast.DefinitionContent>
}

const userCalloutKind = {
    'note': '',
    'tip': '',
    'important': '',
    'warning': '',
    'caution': ''
}

function remarkExport(this: Processor, { filePath }: { filePath?: string }) {
    this.compiler = (tree) => {
        let matter: string | null = null
        const result = filterMap(tree, (node) => {
            if (node.type === 'yaml') {
                // front matter
                matter = (node as mdast.Yaml).value
                return undefined
            }

            if (node.type === 'html') {
                // raw HTML
                const html = node as mdast.Html
                if (!html.value.trimStart().startsWith('<!--')) {
                    console.warn(`${filePath}@${node.position?.start?.line} raw HTML detected. Ignored due to XSS prevention`)
                }
                return undefined
            }

            if (node.type === 'containerDirective') {
                // custom directives
                const n = node as ContainerDirective
                if (n.name in userCalloutKind) {
                    return {
                        type: 'userCallout',
                        kind: n.name,
                        children: n.children,
                    } satisfies UserCallout
                }
                return undefined
            }

            return node
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

const filterMap = (node: mdast.Node, mapFn: (oldNode: mdast.Node, parent?: mdast.Node) => mdast.Node | undefined) => {
    const inner = (oldNode: mdast.Node, parent?: mdast.Node) => {
        const newNode = mapFn(oldNode, parent)
        if (!newNode) {
            return undefined
        }
        if ('children' in oldNode) {
            const newParent = newNode as mdast.Parent
            const nextChildren = newParent.children.flatMap(child => {
                const newChild = inner(child, oldNode)
                return newChild ? [newChild as mdast.RootContent] : []
            })
            newParent.children = nextChildren
        }
        return newNode
    }
    return inner(node)
}
