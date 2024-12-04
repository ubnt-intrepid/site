import { format } from 'date-fns'
import React from 'react'

export type Props = {
    date?: Date
}

const FormattedDate: React.FC<Props> = ({ date }: Props) => {
    const formattedDate = date ? format(date, 'yyyy/MM/dd') : null
    return (
        <time dateTime={date?.toISOString()}>
            {formattedDate}
        </time>
    )
}

export default FormattedDate