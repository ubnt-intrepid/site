import { AppProps } from 'next/app'
import '@fortawesome/fontawesome-free/css/all.css'
import 'highlight.js/styles/atom-one-light.css'
import './styles.scss'

const App = ({ Component, pageProps }: AppProps) => (
    <Component {...pageProps} />
)

export default App
