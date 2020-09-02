import { parseISO, format } from 'date-fns'

export type Props = {
    dateString: string
}

const Date = ({ dateString }: Props) => (
    <time dateTime={dateString}>{format(parseISO(dateString), 'yyyy/MM/dd')}</time>
)

export default Date
