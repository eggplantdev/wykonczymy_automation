import localFont from 'next/font/local'
import { DM_Sans, Space_Mono } from 'next/font/google'

// ABC Favorit - Local custom font
export const abcFavorit = localFont({
  src: [
    {
      path: '../../public/fonts/ABCFavorit-Regular.otf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ABCFavorit-Light.otf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../public/fonts/ABCFavorit-LightItalic.otf',
      weight: '300',
      style: 'italic',
    },
  ],
  variable: '--font-abc-favorit',
  display: 'swap',
})

export const spaceMono = Space_Mono({
  subsets: ['latin', 'latin-ext'],
  weight: ['400'],
  style: ['normal'],
  variable: '--font-space-mono',
  display: 'swap',
})
