'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform } from 'framer-motion'

type ProjectT = {
  title: string
  description: string
  image: string
}

const PROJECTS: ProjectT[] = [
  {
    title: 'Wykończenie mieszkania',
    description: 'Kompleksowy remont od podstaw',
    image:
      'https://www.wykonczymy.com.pl/wp-content/uploads/2024/10/a5805a6b-c9ea-427d-b6cb-d62d87926819.webp',
  },
  {
    title: 'Remont łazienki',
    description: 'Precyzyjne prace wykończeniowe',
    image: 'https://www.wykonczymy.com.pl/wp-content/uploads/2025/09/IMG_4530.webp',
  },
  {
    title: 'Wykończenie salonu',
    description: 'Malowanie i dekoracja ścian',
    image:
      'https://www.wykonczymy.com.pl/wp-content/uploads/2025/09/PHOTO-2025-08-21-16-17-224-1.webp',
  },
  {
    title: 'Remont kuchni',
    description: 'Montaż i wykończenie',
    image:
      'https://www.wykonczymy.com.pl/wp-content/uploads/2025/09/PHOTO-2025-08-21-16-17-214.webp',
  },
  {
    title: 'Prace malarskie',
    description: 'Profesjonalne malowanie wnętrz',
    image:
      'https://www.wykonczymy.com.pl/wp-content/uploads/2025/09/PHOTO-2025-05-28-12-54-163.webp',
  },
  {
    title: 'Wykończenie biura',
    description: 'Remonty lokali usługowych',
    image:
      'https://www.wykonczymy.com.pl/wp-content/uploads/2025/09/PHOTO-2025-08-21-16-17-23.webp',
  },
]

function ProjectCard({ project }: { project: ProjectT }) {
  return (
    <div className="group relative h-[70vh] w-[280px] shrink-0 cursor-pointer overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] md:w-[30vw] lg:w-[35vw] hover:lg:w-[45vw]">
      <div className="h-full w-full rounded-[2rem] bg-[#1c1917]/5 p-1.5 ring-1 ring-[#1c1917]/5">
        <div className="relative h-full w-full overflow-hidden rounded-[calc(2rem-0.375rem)]">
          <Image
            src={project.image}
            alt={project.title}
            fill
            sizes="(min-width: 768px) 40vw, 280px"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1917]/70 via-transparent to-transparent" />

          <div className="absolute right-0 bottom-0 left-0 p-6 md:p-8">
            <span className="text-[0.625rem] tracking-[0.2em] text-white/60 uppercase">
              {project.description}
            </span>
            <h3 className="mt-2 font-serif text-2xl font-normal text-white md:text-3xl">
              {project.title}
            </h3>
          </div>
        </div>
      </div>
    </div>
  )
}

export function WykonczymyProjects() {
  const sectionRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end end'],
  })

  const x = useTransform(scrollYProgress, [0, 1], ['0%', '-60%'])

  return (
    <section ref={sectionRef} className="relative h-[300vh]">
      <div className="sticky top-0 flex min-h-[100dvh] flex-col justify-center overflow-hidden">
        <div className="px-6 pb-12 md:pl-[12vw]">
          <span className="inline-block rounded-full border border-[#e7e0d8] px-3 py-1 text-[0.625rem] tracking-[0.2em] text-[#78716c] uppercase">
            Nasze realizacje
          </span>
          <h2 className="mt-4 font-serif text-4xl font-normal tracking-tight text-[#1c1917] md:text-5xl">
            Realizacje
          </h2>
        </div>

        <motion.div className="flex gap-6 pr-[20vw] pl-6 md:gap-8 md:pl-[12vw]" style={{ x }}>
          {PROJECTS.map((project) => (
            <ProjectCard key={project.title} project={project} />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
