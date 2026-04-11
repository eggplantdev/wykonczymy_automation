'use client'

import { motion } from 'framer-motion'

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
      staggerChildren: 0.15,
    },
  },
}

export function WykonczymyAbout() {
  return (
    <section className="px-6 py-32 md:py-40">
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
          O nas
        </motion.span>

        <div className="mt-12 grid grid-cols-1 gap-16 md:grid-cols-12 md:gap-8">
          <motion.div variants={FADE_UP} className="md:col-span-5">
            <h2 className="font-serif text-4xl leading-[1.1] font-normal tracking-tight text-[#1c1917] md:text-5xl">
              Doskonale znamy się
              <br />
              <em className="font-light">na remontach</em>
            </h2>
          </motion.div>

          <motion.div variants={FADE_UP} className="md:col-span-6 md:col-start-7">
            <p className="max-w-[55ch] text-base leading-relaxed text-[#78716c]">
              Wykonujemy kompleksowe remonty domów, mieszkań, biur, klatek schodowych i lokali
              usługowych. Od prac malarskich, przez montaż sufitów podwieszanych, po dekoracje ścian
              i montaż mebli — każdy projekt traktujemy z najwyższą starannością.
            </p>
            <p className="mt-6 max-w-[55ch] text-base leading-relaxed text-[#78716c]">
              Nasz zespół zawsze służy pomocą i doradztwem. Profesjonalne podejście, przejrzystość
              kosztów i terminowość to fundamenty naszej pracy. Realizujemy projekty szybciej niż
              obiecujemy — bo szanujemy Twój czas.
            </p>

            <div className="mt-12 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-[#e7e0d8] pt-8">
              {[
                'Prace malarskie',
                'Tapetowanie',
                'Dekoracja ścian',
                'Sufity podwieszane',
                'Montaż luster',
                'Montaż mebli',
                'Szklane witryny',
                'Instalacje dekoracyjne',
              ].map((service) => (
                <motion.span key={service} variants={FADE_UP} className="text-sm text-[#78716c]">
                  {service}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}
