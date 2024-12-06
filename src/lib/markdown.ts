import assert from 'node:assert/strict'
import  { unified, Processor } from 'unified'
import type mdast from 'mdast'
import type { ContainerDirective } from 'mdast-util-directive'
import remarkParse from 'remark-parse'
import remarkFrontmatter from 'remark-frontmatter'
import remarkGfm from 'remark-gfm'
import remarkDirective from 'remark-directive'
import remarkMath from 'remark-math'

import { fromMarkdown } from 'mdast-util-from-markdown'
import { fromHtml } from 'hast-util-from-html'
import { toMdast, Options as ToMdastOptions } from 'hast-util-to-mdast'
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

export interface Figure extends mdast.Parent {
    type: 'figure'
}

export interface FigCaption extends mdast.Parent {
    type: 'figcaption'
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
        const result = flatMap(tree as mdast.Root, (node) => {
            if (node.type === 'yaml') {
                // front matter
                matter = (node as mdast.Yaml).value
                return []
            }

            if (node.type === 'html') {
                // raw HTML
                const html = node as mdast.Html

                const hast = filter(fromHtml(html.value, { fragment: true }), node => node.type !== 'comment')
                if (!hast) {
                    return []
                }

                console.warn(`${filePath}:${node.position?.start?.line} raw HTML support is experimental.`)
                const mdast = toMdast(hast, {
                    document: false,
                    handlers: {
                        figure: (state, node) => {
                            const result = {
                                type: 'figure',
                                children: state.all(node)
                            }
                            state.patch(node, result as any)
                            return result
                        },
                        figcaption: (state, node) => {
                            const result = {
                                type: 'figcaption',
                                children: state.all(node)
                            }
                            state.patch(node, result as any)
                            return result
                        }
                    },
                    nodeHandlers: {
                        text: (state, node) => {
                            const parsed = fromMarkdown(node.value, 'utf-8')
                            // => { type: 'root', children: [{ type: 'paragraph', children: [...] }] }

                            if (parsed.children.length == 0) {
                                return
                            }
                            const p = parsed.children[0] as mdast.Paragraph
                            p.children.map(ch => state.patch(node, ch as any))
                            return p.children
                        },
                    }
                } as ToMdastOptions)

                return (mdast as mdast.Root).children
            }

            if (node.type === 'containerDirective') {
                // custom directives
                const n = node as ContainerDirective
                if (n.name in userCalloutKind) {
                    return [{
                        type: 'userCallout',
                        kind: n.name,
                        children: n.children,
                    } satisfies UserCallout]
                }
                return []
            }

            return [node]
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

const flatMap = (tree: mdast.Root, mapFn: (oldNode: mdast.Node, parent?: mdast.Node) => mdast.Node[]) => {
    const inner = (oldNode: mdast.Node, parent?: mdast.Node) => {
        const newNodes = mapFn(oldNode, parent)
        if ('children' in oldNode) {
            for (const newNode of newNodes) {
                const newParent = newNode as mdast.Parent
                const nextChildren = newParent.children.flatMap(child => {
                    return inner(child, oldNode) as mdast.RootContent[]
                })
                newParent.children = nextChildren
            }
        }
        return newNodes
    }
    const result = inner(tree)
    assert(result.length > 0)
    return result[0]
}
