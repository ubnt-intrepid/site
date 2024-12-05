import React from 'react'

export type Props = {
    date?: Date
}

const FormattedDate: React.FC<Props> = ({ date }: Props) => {
    const formattedDate = date
        ? date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
        : null
    return (
        <time dateTime={date?.toISOString()}>
            {formattedDate}
        </time>
    )
}

export default FormattedDate