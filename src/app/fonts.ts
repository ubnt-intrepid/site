import { IBM_Plex_Sans, Noto_Sans_JP } from 'next/font/google'

export const ibmPlexSans = IBM_Plex_Sans({
    weight: ['400', '600', '700'],
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-ibm-plex-sans',
})

export const notoSansJP = Noto_Sans_JP({
    weight: ['400', '700'],
    subsets: ['latin'],
    display: 'swap',
    preload: false,
    variable: '--font-noto-sans-jp',
})
