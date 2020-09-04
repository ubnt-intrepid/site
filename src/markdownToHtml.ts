import remark from 'remark'
import footnotes from 'remark-footnotes'
import remark2rehype from 'remark-rehype'
import raw from 'rehype-raw'
import highlight from 'rehype-highlight'
import html from 'rehype-stringify'

const markdownToHtml = (content: string) => (
    remark()
        .use(footnotes, { inlineNotes: true })
        .use(remark2rehype, { allowDangerousHtml: true })
        .use(raw)
        .use(highlight, { ignoreMissing: true })
        .use(html)
        .process(content)
        .then(processed => processed.toString())
)

export default markdownToHtml
