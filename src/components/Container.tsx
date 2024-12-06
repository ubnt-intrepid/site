import React from 'react'

const Container: React.FC<{
    children?: React.ReactNode
}> = ({ children }) => (
    <div className='container content-center mx-auto my-10'>
        {children}
    </div>
)

export default Container
