import { ShowcaseSection } from '../showcase-section'
import { ColorPalette } from './color-palette'

export function ColorsSection() {
  return (
    <ShowcaseSection id="colors">
      <div className="grid gap-4 pt-4 lg:grid-cols-2">
        <div className="bg-background text-foreground rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Motyw bieżący</p>
          <ColorPalette />
        </div>
        <div className="dark bg-background text-foreground rounded-lg border p-4">
          <p className="text-muted-foreground text-xs">Ciemny (.dark)</p>
          <ColorPalette />
        </div>
      </div>
    </ShowcaseSection>
  )
}
