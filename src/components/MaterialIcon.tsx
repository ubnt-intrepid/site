import React from "react";

type Props = {
    name: string
}

const MaterialIcon: React.FC<Props> = ({ name }) => (
    <span className='material-icons' aria-hidden>
        {name}
    </span>
)

export const Calendar: React.FC = () => <MaterialIcon name='calendar_month' />
export const Folder: React.FC = () => <MaterialIcon name='folder' />
export const Tag: React.FC = () => <MaterialIcon name='sell' />
export const Edit: React.FC = () => <MaterialIcon name='edit' />

export default MaterialIcon
