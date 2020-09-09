import unified from 'unified'
import markdown from 'remark-parse'
import footnotes from 'remark-footnotes'
import remark2rehype from 'remark-rehype'
import raw from 'rehype-raw'
import highlight from 'rehype-highlight'
import html from 'rehype-stringify'
import u from 'unist-builder'

const markdownToHtml = (content: string) => (
    unified()
        .use(markdown)
        .use(footnotes, { inlineNotes: true })
        .use(remark2rehype, {
            allowDangerousHtml: true,
            handlers: {
                code: (h, node) => {
                    let value = node.value ? node.value + '\n' : ''
                    let lang = node.lang && (node.lang as string).match(/^[^ \t]+(?=[ \t]|$)/)
                    let props: { className?: string[]; position?: unknown } = {}
                  
                    if (lang) {
                      props.className = ['language-' + lang]
                    }

                    let children = []
                    if (node.meta) {
                        children.push(h(node, 'span', { class: 'code-block-title' }, [
                            u('text', node.meta)
                        ]))
                    }
                    children.push(h(node, 'pre', { class: 'code-block-body' }, [
                        h(node, 'code', props, [
                            u('text', value)
                        ])
                    ]))

                    return h(node, 'div', { class: 'code-block' }, children)
                },
            }
        })
        .use(raw)
        .use(highlight, { ignoreMissing: true })
        .use(html)
        .process(content)
        .then(processed => processed.toString())
)

export default markdownToHtml
