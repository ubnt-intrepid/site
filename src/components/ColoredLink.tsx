import Link from 'next/link'
import { HTMLAttributeAnchorTarget } from 'react'

const ColoredLink: React.FC<{
    href: string
    as?: string
    title?: string
    target?: HTMLAttributeAnchorTarget
    children?: React.ReactNode
}> = (props) => (
    <Link {...props} className='no-underline text-orange-600 hover:underline' />
)

export default ColoredLink
