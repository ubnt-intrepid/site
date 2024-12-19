import assert from 'node:assert/strict'
import type mdast from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { frontmatterFromMarkdown } from 'mdast-util-frontmatter'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { mathFromMarkdown } from 'mdast-util-math'
import { mdxExpressionFromMarkdown } from 'mdast-util-mdx-expression'
import { MdxJsxFlowElement, mdxJsxFromMarkdown } from 'mdast-util-mdx-jsx'
import { frontmatter } from 'micromark-extension-frontmatter'
import { gfm } from 'micromark-extension-gfm'
import { math } from 'micromark-extension-math'
import { mdxExpression } from 'micromark-extension-mdx-expression'
import { mdxJsx } from 'micromark-extension-mdx-jsx'
import { visit } from 'unist-util-visit'
import { normalizeUri } from 'micromark-util-sanitize-uri'

export interface Content extends mdast.Root {
    footnotes: mdast.FootnoteDefinition[]
}

export interface FootnoteReference extends mdast.Node {
    type: 'footnoteReference'
    identifier: string
    label: string
}

export interface Alert extends mdast.Parent {
    type: 'alert'
    kind: AlertKind
    children: Array<mdast.BlockContent | mdast.DefinitionContent>
}

const alertKindArray = ['note', 'tip', 'important', 'warning', 'caution'] as const
export type AlertKind = (typeof alertKindArray)[number]

// ---

export type Options = {
    useMDX?: boolean
}

export type ParseResult = {
    matter: string
    content: Content
}

export const parseMarkdown = (content: string, filePath: string, options?: Options) => {
    const options_ = options ?? {}
    const tree = options_.useMDX
        ? fromMDX(content)
        : fromCommonMark(content)

    const definitions = new Map<string, mdast.Definition>()
    const footnoteDefinitions = new Map<string, mdast.FootnoteDefinition>()
    visit(tree, (node) => {
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

    let matter: string | null = null
    const result = flatMap(tree, (node) => {
        if (node.type === 'yaml') {
            // front matter
            matter = (node as mdast.Yaml).value
            return []
        }

        if (node.type === 'html') {
            // raw HTML
            const html = node as mdast.Html
            if (!html.value.trimStart().startsWith('<!--')) {
                console.warn(`${filePath}:${node.position?.start?.line}`)
                console.warn('    Raw HTMLs are always ignored in CommonMark mode. Use MDX mode instead.')
            }
            return []
        }

        if (node.type === 'mdxJsxFlowElement') {
            // JSX flow element
            const jsx = node as MdxJsxFlowElement
            if (!jsx.attributes.every(attr => (
                attr.type === 'mdxJsxAttribute'
                    && (attr.value === null || typeof(attr.value) === 'string')
            ))) {
                assert.fail('JSX attributes must be `string` of `null`.')
            }

            if (!jsx.name) {
                // Fragment
                return jsx.children
            }

            if (jsx.name == 'Alert') {
                const kindAttr = jsx.attributes.find(attr => attr.type === 'mdxJsxAttribute' && attr.name === 'kind')
                let kind: AlertKind = 'note'
                if (kindAttr && kindAttr.type === 'mdxJsxAttribute') {
                    const rawKind = kindAttr.value as string
                    if (!alertKindArray.includes(rawKind as AlertKind)) {
                        console.warn(`${filePath}:${kindAttr.position?.start?.line}`)
                        console.warn(`    Unknown alert kind specified: ${rawKind}`)
                    } else {
                        kind = rawKind as AlertKind
                    }
                }
                return [{
                    type: 'alert',
                    kind,
                    children: jsx.children
                } satisfies Alert]
            }
            return []
        }

        if (node.type === 'mdxJsxTextElement') {
            // placeholder
            return []
        }

        if (node.type === 'mdxTextExpression' || node.type === 'mdxFlowExpression') {
            // The MDX expressions are currently enabled only for the purpose of enabling
            // in-document comments. Therefore, all of their contents are completely removed
            // from the document regardless of whether the expressions are valid JavaScript
            // program or not.
            return []
        }

        if (node.type === 'imageReference') {
            const ref = node as mdast.ImageReference
            const img = definitions.get(ref.identifier)
            return img ? [{
                type: 'image',
                url: img.url,
                title: img.title,
                alt: ref.alt,
                position: ref.position,
            } satisfies mdast.Image] : []
        }

        if (node.type === 'linkReference') {
            const ref = node as mdast.LinkReference
            const link = definitions.get(ref.identifier)
            return link ? [{
                type: 'link',
                url: link.url,
                title: link.title,
                position: ref.position,
                children: ref.children,
            } satisfies mdast.Link] : []
        }

        if (node.type === 'definition' || node.type === 'footnoteDefinition') {
            return []
        }

        if (node.type === 'footnoteReference') {
            const node_ = node as mdast.FootnoteReference
            const ref = footnoteDefinitions.get(node_.identifier)
            if (!ref) {
                return []
            }
            const index = footnoteIdentifiers.indexOf(node_.identifier)
            const identifier = `footnote-${normalizeUri(ref.identifier.toLowerCase())}`
            return [{
                type: 'footnoteReference',
                identifier,
                label: `${index + 1}`,
            } satisfies FootnoteReference]    
        }

        return [node]
    })

    if (result.length === 0) {
        assert.fail('filtered mdast should not be empty')
    }

    const root = result[0]
    if (root.type !== 'root') {
        assert.fail('the root node must be mdast.Root')
    }

    return {
        matter: matter ?? "",
        content: {
            ...root as mdast.Root,
            footnotes: footnoteDefinitions.values().toArray(),
        }
    } satisfies ParseResult as ParseResult
}

const fromCommonMark = (content: string) => {
    return fromMarkdown(content, 'utf-8', {
        extensions: [
            frontmatter(),
            gfm(),
            math(),
        ],
        mdastExtensions: [
            frontmatterFromMarkdown(),
            gfmFromMarkdown(),
            mathFromMarkdown(),
        ]
    })
}

const fromMDX = (content: string) => {
    return fromMarkdown(content, 'utf-8', {
        extensions: [
            frontmatter(),
            gfm(),
            math(),
            mdxExpression(),
            mdxJsx(),
        ],
        mdastExtensions: [
            frontmatterFromMarkdown(),
            gfmFromMarkdown(),
            mathFromMarkdown(),
            mdxExpressionFromMarkdown(),
            mdxJsxFromMarkdown(),
        ]
    })
}

const flatMap = (node: mdast.Node, mapFn: (oldNode: mdast.Node, parent?: mdast.Node) => mdast.Node[]) => {
    const inner = (oldNode: mdast.Node, parent?: mdast.Node) => {
        const newNodes = mapFn(oldNode, parent)
        if (!newNodes) {
            return []
        }
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
    return inner(node)
}
