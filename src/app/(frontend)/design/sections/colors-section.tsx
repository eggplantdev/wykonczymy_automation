import { ShowcaseSection } from '../showcase-section'
import { ColorPalette } from './color-palette'
import { Description } from '@/components/ui/description'

export function ColorsSection() {
  return (
    <ShowcaseSection id="colors">
      <div className="grid gap-4 pt-4 lg:grid-cols-2">
        <div className="bg-background text-foreground rounded-lg border p-4">
          <Description withIcon={false} size="xs">
            Motyw bieżący
          </Description>
          <ColorPalette />
        </div>
        <div className="dark bg-background text-foreground rounded-lg border p-4">
          <Description withIcon={false} size="xs">
            Ciemny (.dark)
          </Description>
          <ColorPalette />
        </div>
      </div>
    </ShowcaseSection>
  )
}
