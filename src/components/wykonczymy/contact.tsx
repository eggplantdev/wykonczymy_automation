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
          className="border-wk-sand text-2xs tracking-wk text-wk-stone inline-block rounded-full border px-3 py-1 uppercase"
        >
          Kontakt
        </motion.span>

        <motion.h2
          variants={FADE_UP}
          className="text-wk-ink mt-8 max-w-xl font-serif text-4xl leading-[1.1] font-normal tracking-tight md:text-6xl"
        >
          Umów się na
          <br />
          <em className="font-light">darmową wycenę</em>
        </motion.h2>

        <motion.p
          variants={FADE_UP}
          className="text-wk-stone mt-8 max-w-[50ch] text-base leading-relaxed"
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
            className="group bg-wk-ink text-wk-cream ease-wk hover:bg-wk-ink-hover inline-flex items-center gap-3 rounded-full py-3 pr-3 pl-6 text-sm font-medium transition-all duration-500 active:scale-[0.98]"
          >
            <Phone className="size-4" strokeWidth={1.5} />
            <span>+48 505 805 425</span>
            <span className="ease-wk ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
              <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </span>
          </a>

          <a
            href="mailto:biuro@wykonczymy.com.pl"
            className="group border-wk-sand text-wk-ink ease-wk hover:bg-wk-ink/5 inline-flex w-fit items-center gap-3 rounded-full border bg-transparent py-3 pr-3 pl-6 text-sm font-medium transition-all duration-500 active:scale-[0.98]"
          >
            <Mail className="size-4" strokeWidth={1.5} />
            <span>biuro@wykonczymy.com.pl</span>
            <span className="bg-wk-ink/5 ease-wk flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-500 group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105">
              <ArrowUpRight className="size-3.5" strokeWidth={1.5} />
            </span>
          </a>
        </motion.div>

        <motion.div
          variants={FADE_UP}
          className="text-wk-stone mt-8 flex items-center gap-2 text-sm"
        >
          <MapPin className="size-3.5" strokeWidth={1.5} />
          <span>ul. Terespolska 2, 03-813 Warszawa</span>
        </motion.div>

        <motion.div
          variants={FADE_UP}
          className="border-wk-sand text-wk-stone mt-32 flex flex-col gap-4 border-t pt-8 text-xs md:flex-row md:items-center md:justify-between"
        >
          <span>Wykończymy, 2024</span>
          <div className="flex gap-6">
            <a
              href="https://www.facebook.com/people/Wyko%C5%84czymy/100085905117915/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wk-ink transition-colors duration-300"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/wykonczymy_bartosz_antonik/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wk-ink transition-colors duration-300"
            >
              Instagram
            </a>
            <a
              href="https://fixly.pl/profil/tYMYyA5I"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-wk-ink transition-colors duration-300"
            >
              Fixly
            </a>
          </div>
        </motion.div>
      </motion.div>
    </section>
  )
}
