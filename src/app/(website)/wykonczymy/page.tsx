import { WykonczymyHero } from '@/components/wykonczymy/hero'
import { WykonczymyProjects } from '@/components/wykonczymy/projects'
import { WykonczymyAbout } from '@/components/wykonczymy/about'
import { WykonczymyContact } from '@/components/wykonczymy/contact'
import { WykonczymyNav } from '@/components/wykonczymy/nav'
import { WykonczymyFilmGrain } from '@/components/wykonczymy/film-grain'

export default function WykonczymyPage() {
  return (
    <>
      <WykonczymyFilmGrain />
      <WykonczymyNav />
      <main>
        <WykonczymyHero />
        <section id="realizacje">
          <WykonczymyProjects />
        </section>
        <section id="o-nas">
          <WykonczymyAbout />
        </section>
        <section id="kontakt">
          <WykonczymyContact />
        </section>
      </main>
    </>
  )
}
