'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, Phone, Mail, MapPin } from 'lucide-react'

const FADE_UP = {
  hidden: { opacity: 0, y: 40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      ease: [0.32, 0.72, 0, 1] as const,
    },
  },
}

const STAGGER_CONTAINER = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

export function WykonczymyContact() {
  return (
    <section className="px-6 py-32 md:px-0 md:py-40">
      <motion.div
        className="mx-auto max-w-7xl md:pl-[12vw]"
        variants={STAGGER_CONTAINER}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-100px' }}
      >
        <motion.span
          variants={FADE_UP}
          className="inline-block rounded-full border border-[#e7e0d8] px-3 py-1 text-[0.625rem] tracking-[0.2em] text-[#78716c] uppercase"
        >
          Kontakt
        </motion.span>

        <motion.h2
          variants={FADE_UP}
          className="mt-8 max-w-xl font-serif text-4xl leading-[1.1] font-normal tracking-tight text-[#1c1917] md:text-6xl"
        >
          Umów się na
          <br />
          <em className="font-light">darmową wycenę</em>
        </motion.h2>

        <motion.p
          variants={FADE_UP}
          className="mt-8 max-w-[50ch] text-base leading-relaxed text-[#78716c]"
        >
          Każdy remont zaczyna się od rozmowy. Opowiedz nam o swoich potrzebach, a my zaproponujemy
          najlepsze rozwiązanie.
        </motion.p>

        <motion.div
          variants={FADE_UP}
          className="cols-2 mt-12 grid w-fit gap-4 md:grid-cols-2 md:gap-10"
        >
          <a
            href="tel:+48505805425"
            className="group inline-flex items-center gap-3 rounded-full bg-[#1c1917] py-3 pr-3 pl-6 text-sm font-medium text-[#fdfbf7] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#292524] active:scale-[0.98]"
          >
            <Phone size={16} strokeWidth={1.5} />
            <span>+48 505 805 425</span>
            <span className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
              <ArrowUpRight size={14} strokeWidth={1.5} />
            </span>
          </a>

          <a
            href="mailto:biuro@wykonczymy.com.pl"
            className="group inline-flex w-fit items-center gap-3 rounded-full border border-[#e7e0d8] bg-transparent py-3 pr-3 pl-6 text-sm font-medium text-[#1c1917] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-[#1c1917]/5 active:scale-[0.98]"
          >
            <Mail size={16} strokeWidth={1.5} />
            <span>biuro@wykonczymy.com.pl</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1c1917]/5 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
              <ArrowUpRight size={14} strokeWidth={1.5} />
            </span>
          </a>
        </motion.div>

        <motion.div
          variants={FADE_UP}
          className="mt-8 flex items-center gap-2 text-sm text-[#78716c]"
        >
          <MapPin size={14} strokeWidth={1.5} />
          <span>ul. Terespolska 2, 03-813 Warszawa</span>
        </motion.div>

        <motion.div
          variants={FADE_UP}
          className="mt-32 flex flex-col gap-4 border-t border-[#e7e0d8] pt-8 text-xs text-[#78716c] md:flex-row md:items-center md:justify-between"
        >
          <span>Wykończymy, 2024</span>
          <div className="flex gap-6">
            <a
              href="https://www.facebook.com/people/Wyko%C5%84czymy/100085905117915/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-300 hover:text-[#1c1917]"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/wykonczymy_bartosz_antonik/"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-300 hover:text-[#1c1917]"
            >
              Instagram
            </a>
            <a
              href="https://fixly.pl/profil/tYMYyA5I"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors duration-300 hover:text-[#1c1917]"
            >
              Fixly
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
