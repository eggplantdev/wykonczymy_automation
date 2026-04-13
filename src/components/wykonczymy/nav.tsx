'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const NAV_LINKS = [
  { label: 'Oferta', href: '#oferta' },
  { label: 'Realizacje', href: '#realizacje' },
  { label: 'O nas', href: '#o-nas' },
  { label: 'Kontakt', href: '#kontakt' },
]

export function WykonczymyNav() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-1/2 z-50 mt-6 -translate-x-1/2">
        <div className="flex items-center gap-6 rounded-full border border-[#e7e0d8]/80 bg-[#fdfbf7]/80 px-6 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <a href="#" className="text-sm font-medium tracking-tight text-[#1c1917]">
            Wykończymy
          </a>

          <div className="hidden gap-5 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-xs tracking-wide text-[#78716c] transition-colors duration-300 hover:text-[#1c1917]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative flex h-6 w-6 flex-col items-center justify-center gap-[5px] md:hidden"
            aria-label={isOpen ? 'Zamknij menu' : 'Otwórz menu'}
          >
            <motion.span
              className="block h-px w-4 bg-[#1c1917]"
              animate={isOpen ? { rotate: 45, y: 3, width: 16 } : { rotate: 0, y: 0, width: 16 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            />
            <motion.span
              className="block h-px w-4 bg-[#1c1917]"
              animate={isOpen ? { rotate: -45, y: -3, width: 16 } : { rotate: 0, y: 0, width: 16 }}
              transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-40 flex items-center justify-center bg-[#fdfbf7]/95"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex flex-col items-center gap-8">
              {NAV_LINKS.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="font-serif text-4xl font-normal text-[#1c1917]"
                  initial={{ opacity: 0, y: 48 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{
                    duration: 0.6,
                    delay: i * 0.1,
                    ease: [0.32, 0.72, 0, 1],
                  }}
                >
                  {link.label}
                </motion.a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
