'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'

export function WykonczymyHero() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  })

  const leftX = useTransform(scrollYProgress, [0, 0.6], ['0%', '-100%'])
  const rightX = useTransform(scrollYProgress, [0, 0.6], ['0%', '100%'])
  const imageScale = useTransform(scrollYProgress, [0, 0.8], [1.15, 1])
  const imageOpacity = useTransform(scrollYProgress, [0.6, 1], [1, 0])
  const textY = useTransform(scrollYProgress, [0, 0.4], ['0%', '-20%'])
  const textOpacity = useTransform(scrollYProgress, [0.2, 0.5], [1, 0])

  return (
    <section ref={containerRef} className="relative h-[200vh]">
      <div className="sticky top-0 min-h-[100dvh] overflow-hidden">
        <motion.div
          className="absolute inset-0"
          style={{ scale: imageScale, opacity: imageOpacity }}
        >
          <Image
            src="https://www.wykonczymy.com.pl/wp-content/uploads/2023/09/offer2.jpeg"
            alt="Profesjonalnie wykończone wnętrze mieszkania"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-[#fdfbf7]/20" />
        </motion.div>

        <motion.div
          className="absolute inset-0 z-10 w-1/2 origin-left bg-[#fdfbf7]"
          style={{ x: leftX }}
        />
        <motion.div
          className="absolute inset-0 left-1/2 z-10 w-1/2 origin-right bg-[#fdfbf7]"
          style={{ x: rightX }}
        />

        <motion.div
          className="absolute inset-0 z-20 flex items-end px-6 pb-32 md:items-center md:pb-0 md:pl-[12vw]"
          style={{ y: textY, opacity: textOpacity }}
        >
          <div className="max-w-2xl">
            <span className="mb-6 inline-block rounded-full border border-[#e7e0d8] px-3 py-1 text-[0.625rem] tracking-[0.2em] text-[#78716c] uppercase">
              Remonty i wykończenia — Warszawa
            </span>
            <h1 className="font-serif text-5xl leading-[0.95] font-normal tracking-tight text-[#1c1917] md:text-7xl lg:text-8xl">
              Twój dom,
              <br />
              <em className="font-light">nasze wykończenie</em>
            </h1>
            <p className="mt-8 max-w-[45ch] text-base leading-relaxed text-[#78716c]">
              Kompleksowe remonty domów, mieszkań i biur. Profesjonalne podejście, precyzja
              wykonania i doradztwo na każdym etapie.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
