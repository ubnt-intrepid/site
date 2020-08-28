import { useEffect, useState } from 'react'
import { siteRepo } from '../lib/config'

let nextId = 0;
const uniqueId = (prefix: string) => {
    return `${prefix}-${nextId += 1}`
}

const Utterances = () => {
    const [visible, setVisible] = useState(false);
    const [containerId] = useState(() => uniqueId('utterances-container'));

    useEffect(() => {
        if (visible) {
            const script = document.createElement('script');
            script.src = "https://utteranc.es/client.js";
            script.async = true;
            script.crossOrigin = "anonymous";
            script.setAttribute("repo", siteRepo);
            script.setAttribute("issue-term", "pathname");
            script.setAttribute("theme", "github-light");

            const container = document.getElementById(containerId);
            container.appendChild(script);
        }
    });

    return (
        <div className="container" id={containerId}>
            { visible ? null : (
                <div className="columns">
                    <button className="button column is-10 is-offset-1" onClick={() => setVisible(true)}>Show comments</button>
                </div>
             ) }
        </div>
    );
}

export default Utterances
