import Link from 'next/link'
import { siteTitle } from '../config'

export type Props = {
    hideSiteTitle?: boolean
}

const Header = ({ hideSiteTitle }: Props) => {
    const onClick = () => {
        const burger = document.querySelector('.burger') as HTMLElement;
        const menu = document.querySelector('#' + burger.dataset.target) as HTMLElement;
        burger.classList.toggle('is-active');
        menu.classList.toggle('is-active');
    };

    return (
        <header>
            <nav className="navbar">
                <div className="container">
                    <div className="navbar-brand">
                        {hideSiteTitle === true ? null : <Link href="/"><a className="navbar-item">{siteTitle}</a></Link>}

                        <span className="navbar-burger burger" data-target="navbarMenu" onClick={onClick}>
                            <span></span>
                            <span></span>
                            <span></span>
                        </span>
                    </div>

                    <div id="navbarMenu" className="navbar-menu">
                        <div className="navbar-end">
                            <a className="navbar-item is-active" href="/tags">Tags</a>
                            <a className="navbar-item is-active" href="/categories">Categories</a>
                        </div>
                    </div>
                </div>
            </nav>
        </header>
    );
};

export default Header
