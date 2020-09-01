import Link from 'next/link'
import { siteTitle } from '../config'

export type Props = {
    hideSiteTitle?: boolean
}

const Header = ({ hideSiteTitle }: Props) => {
    return (
        <header>
            { hideSiteTitle === true ? null : <Link href="/"><a>{siteTitle}</a></Link> }
            <nav>
                <ul>
                    <li><Link href="/tags"><a>Tags</a></Link></li>
                    <li><Link href="/categories"><a>Categories</a></Link></li>
                </ul>
            </nav>
        </header>
    );
};

export default Header
