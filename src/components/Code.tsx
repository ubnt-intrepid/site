import React from 'react'
import * as prod from 'react/jsx-runtime'
import * as shiki from 'shiki'
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeReact from 'rehype-react'

const langAlias: Record<string, string> = {
    'command': 'shellsession',
    'shell-session': 'shellsession',
}

const normalizeLanguageName = (lang?: string) => {
    if (!lang) {
        return 'txt'
    }
    if (lang in langAlias) {
        return langAlias[lang]
    }
    return lang
}

const Code: React.FC<{
    lang?: string
    title?: string
    children?: string
}> = async ({ lang, title, children }) => {
    const rendered = await shiki.codeToHtml(
        children ?? '',
        {
            lang: normalizeLanguageName(lang),
            theme: 'vitesse-light',
        } satisfies shiki.CodeToHastOptions)

    const codeBlock = (await unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeReact, {
            Fragment: prod.Fragment,
            jsx: prod.jsx,
            jsxs: prod.jsxs,
            components: {
                pre: (props) => {
                    const addedClasses = 'm-0 px-5 py-3 border-2 border-solid border-slate-300 rounded-b-md rounded-tr-md whitespace-pre-wrap'
                    const className = props.className ? `${props.className} ${addedClasses}` : addedClasses
                    return <pre {...props} className={className} />
                }
            }
        })
        .process(rendered))
        .result

    return <div className='my-6'>
        { title ? <span className='inline-block px-2 py-1 -mb-px rounded-t-sm
            text-sm font-mono font-bold
            bg-orange-600 text-orange-5'>{title}</span> : null }
        {codeBlock}
    </div>
}

export default Code
