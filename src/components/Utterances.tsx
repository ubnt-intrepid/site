import { useState } from 'react'
import { siteRepo } from '../config'

const Utterances = () => {
    const [initialized, setInitialized] = useState(false);

    return (
        <section ref={elem => {
            if (!elem) {
                return;
            }

            if (!initialized) {
                const script = document.createElement('script');
                script.src = "https://utteranc.es/client.js";
                script.async = true;
                script.crossOrigin = "anonymous";
                script.setAttribute("repo", siteRepo);
                script.setAttribute("issue-term", "pathname");
                script.setAttribute("theme", "github-light");

                elem.appendChild(script);
                setInitialized(true);
            }
        }} />
    );
}

export default Utterances
