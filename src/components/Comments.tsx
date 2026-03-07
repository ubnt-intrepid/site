'use client'

import React from 'react'
import Giscus from '@giscus/react'
import { siteRepo, siteRepoId } from '@/config'

const Comments: React.FC = () => {
    return (
        <Giscus
            repo={siteRepo}
            repoId={siteRepoId}
            category="Announcements"
            categoryId="DIC_kwDOBIo4I84Ckmyt"
            mapping="pathname"
            strict="0"
            reactionsEnabled="1"
            emitMetadata="0"
            inputPosition="top"
            theme="light"
            lang="ja"
        />
    )
}

export default Comments
