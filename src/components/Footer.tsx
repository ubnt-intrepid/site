import { authorName, authorUrl } from '../config'

export type Props = {}

const Footer = ({}: Props) => (
    <footer className="footer">
        <div className="content has-text-centered">
            <p>
                &copy; 2019-2020 <strong><a href={authorUrl} target="_blank">{authorName}</a></strong>.
            </p>
        </div>
    </footer>
)

export default Footer
