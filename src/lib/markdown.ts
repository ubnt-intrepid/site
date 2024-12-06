import assert from 'node:assert/strict'
import type mdast from 'mdast'
import { directiveFromMarkdown, ContainerDirective } from 'mdast-util-directive'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { directive } from 'micromark-extension-directive'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'

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

type ParseResult = {
    matter: string
    content: mdast.Root,
}

export const parseMarkdown = (content: string, filePath: string) => {
    const tree = fromMarkdown(content, 'utf-8', {
        extensions: [
            directive(),
            frontmatter(),
            gfm(),
            math(),
        ],
        mdastExtensions: [
            directiveFromMarkdown(),
            frontmatterFromMarkdown(),
            gfmFromMarkdown(),
            mathFromMarkdown(),
        ]
    })

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
