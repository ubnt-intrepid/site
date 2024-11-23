import Link from 'next/link'
import React, { ReactElement, ReactNode } from 'react'

export type Props = {
    title: ReactElement | string
    href?: string
    subtitle?: string
    children?: ReactNode
}

const Headline: React.FC<Props> = ({ title, href, subtitle, children }) => {
    return (
            <div className='headline'>
                <h1 className='title'>
                    { href ? <Link href={href}>{title}</Link> : title }
                </h1>
                { subtitle ? <p className='subtitle'>{subtitle}</p> : null}
                {children}
            </div>
    )
}

export default Headline
