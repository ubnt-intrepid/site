import { AppProps } from 'next/app'
import '@fortawesome/fontawesome-free/css/all.css'
import 'bulma/css/bulma.css'
import 'bulmaswatch/united/bulmaswatch.min.css'
import 'highlight.js/styles/atom-one-light.css'
import '../styles/blog.scss'

const App = ({ Component, pageProps }: AppProps) => (
    <Component {...pageProps} />
)

export default App
