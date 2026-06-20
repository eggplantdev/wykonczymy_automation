'use client'

import { useCallback, useRef, useState } from 'react'

// Wysokość wypełniająca widok: od górnej krawędzi elementu do dołu okna (minus gap).
// Liczona z `window.innerHeight - rect.top`, NIE z własnego clientHeight elementu —
// pozycja górna zależy od navbara/nagłówka NAD siatką, których siatka nie zmienia, więc
// wartość jest stabilna. Bez ResizeObserver: mierzenie clientHeight kontenera siatki
// wpadało w pętlę z wewnętrznym resize-detectorem react-datasheet-grid (ciągłe „mruganie",
// tysiące Issues/s w DevTools). Pomiar tylko przy montażu i resize okna; floor + gap, żeby
// siatka była odrobinę niższa niż dostępne miejsce → brak paska przewijania przodka → brak oscylacji.
export function useElementHeight(
  gap = 8,
  fallback = 600,
): [(node: HTMLElement | null) => void, number] {
  const [height, setHeight] = useState(fallback)
  const nodeRef = useRef<HTMLElement | null>(null)

  const measure = useCallback(() => {
    const node = nodeRef.current
    if (!node) return
    const top = node.getBoundingClientRect().top
    const next = Math.max(240, Math.floor(window.innerHeight - top - gap))
    setHeight((prev) => (prev === next ? prev : next))
  }, [gap])

  const ref = useCallback(
    (node: HTMLElement | null) => {
      nodeRef.current = node
      if (!node) return
      // rAF: zmierz po ustabilizowaniu layoutu, nie w trakcie commitu.
      requestAnimationFrame(measure)
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    },
    [measure],
  )

  return [ref, height]
}
