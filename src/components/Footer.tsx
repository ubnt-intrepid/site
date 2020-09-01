import { authorName, authorUrl } from '../config'

export type Props = {}

const Footer = ({}: Props) => (
    <footer>
        <p>
            &copy; 2019-2020 <strong><a href={authorUrl} target="_blank">{authorName}</a></strong>.
        </p>
    </footer>
)

export default Footer
