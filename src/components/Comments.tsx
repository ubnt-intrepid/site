'use client'

// FIXME: use @giscus/react directly

import React, { useState } from 'react'
import { siteRepo, siteRepoId } from '@/config'

const Comments: React.FC = () => {
    const [initialized, setInitialized] = useState(false)
    return (
        <div className='container mx-auto mt-12 mb-auto' ref={elem => {
            if (!elem) {
                return
            }

            if (!initialized) {
                const script = document.createElement('script')
                script.src = "https://giscus.app/client.js"
                script.async = true
                script.crossOrigin = "anonymous"
                script.dataset.repo = siteRepo 
                script.dataset.repoId = siteRepoId
                script.dataset.category = "Announcements"
                script.dataset.categoryId = "DIC_kwDOBIo4I84Ckmyt"
                script.dataset.mapping = "pathname"
                script.dataset.strict = "0"
                script.dataset.reactionsEnabled = "1"
                script.dataset.emitMetadata = "0"
                script.dataset.inputPosition = "top"
                script.dataset.theme = "light"
                script.dataset.lang = "ja"
                
                elem.appendChild(script)
                setInitialized(true)
            }
        }} />
    )
}

export default Comments