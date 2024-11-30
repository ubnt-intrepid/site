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
            <div className='text-center py-8 bg-orange-400 text-orange-50'>
                <h1 className='text-3xl'>
                    { href ? <Link href={href}>{title}</Link> : title }
                </h1>
                { subtitle ? <p className='text-base'>{subtitle}</p> : null}
                {children}
            </div>
    )
}

export default Headline
