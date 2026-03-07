import React from 'react'

const Container: React.FC<{
    children?: React.ReactNode
}> = ({ children }) => (
    <div className='max-w-3xl mx-auto my-10 px-4'>
        {children}
    </div>
)

export default Container
