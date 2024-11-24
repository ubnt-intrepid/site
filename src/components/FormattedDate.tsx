import { format, parseISO } from 'date-fns'
import React from 'react'

export type Props = {
    date?: string
}

const FormattedDate: React.FC<Props> = ({ date }: Props) => {
    const formattedDate = date ? format(parseISO(date), 'yyyy/MM/dd') : null
    return (
        <time dateTime={date}>
            {formattedDate}
        </time>
    )
}

export default FormattedDate