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
          className="border-wk-sand text-2xs tracking-wk text-wk-stone inline-block rounded-full border px-3 py-1 uppercase"
        >
          O nas
        </motion.span>

        <div className="mt-12 grid grid-cols-1 gap-16 md:grid-cols-12 md:gap-8">
          <motion.div variants={FADE_UP} className="md:col-span-5">
            <h2 className="text-wk-ink font-serif text-4xl leading-[1.1] font-normal tracking-tight md:text-5xl">
              Doskonale znamy się
              <br />
              <em className="font-light">na remontach</em>
            </h2>
          </motion.div>

          <motion.div variants={FADE_UP} className="md:col-span-6 md:col-start-7">
            <p className="text-wk-stone max-w-[55ch] text-base leading-relaxed">
              Wykonujemy kompleksowe remonty domów, mieszkań, biur, klatek schodowych i lokali
              usługowych. Od prac malarskich, przez montaż sufitów podwieszanych, po dekoracje ścian
              i montaż mebli — każdy projekt traktujemy z najwyższą starannością.
            </p>
            <p className="text-wk-stone mt-6 max-w-[55ch] text-base leading-relaxed">
              Nasz zespół zawsze służy pomocą i doradztwem. Profesjonalne podejście, przejrzystość
              kosztów i terminowość to fundamenty naszej pracy. Realizujemy projekty szybciej niż
              obiecujemy — bo szanujemy Twój czas.
            </p>

            <div className="border-wk-sand mt-12 grid grid-cols-2 gap-x-8 gap-y-3 border-t pt-8">
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
                <motion.span key={service} variants={FADE_UP} className="text-wk-stone text-sm">
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
