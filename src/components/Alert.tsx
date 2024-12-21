import { AlertKind } from "@/lib/markdown"
import MaterialIcon from "./MaterialIcon"

const alertStyles: Record<AlertKind, { icon: string, title: string }> = {
    'note': {
        icon: 'error',
        title: 'Note'
    },
    'tip': {
        icon: 'lightbulb',
        title: 'Tip'
    },
    'important': {
        icon: 'warning',
        title: 'Important'
    },
    'warning': {
        icon: 'warning',
        title: 'Warning'
    },
    'caution': {
        icon: 'error',
        title: 'Caution'
    }
}

const Alert: React.FC<{
    kind: AlertKind
    children?: React.ReactNode
}> = ({ kind, children }) => {
    const { icon, title } = alertStyles[kind]

    return <div className='px-5 py-3 my-10 border-l-4 border-orange-600 relative'>
        <div className='font-bold text-xl text-orange-600 my-0'>
            <MaterialIcon name={icon} />
            &nbsp;
            {title}
        </div>
        { children }
    </div>    
}

export default Alert
