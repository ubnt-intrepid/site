import React from 'react'
import * as prod from 'react/jsx-runtime'
import { fromHtml } from 'hast-util-from-html'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import * as shiki from 'shiki'

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
    const html = await shiki.codeToHtml(children ?? '', {
        lang: normalizeLanguageName(lang),
        theme: 'vitesse-light',
    })
    const hast = fromHtml(html, { fragment: true})
    const codeBlock = toJsxRuntime(hast, {
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

    return <div className='my-6'>
        { title ? <span className='inline-block px-2 py-1 -mb-px rounded-t-sm
            text-sm font-mono font-bold
            bg-orange-600 text-orange-50'>{title}</span> : null }
        {codeBlock}
    </div>
}

export default Code
