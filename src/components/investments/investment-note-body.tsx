import { parseNoteMarkdown } from '@/lib/investments/note-markdown'
import type { NoteInlineT } from '@/lib/investments/types'

function Inline({ runs }: { runs: NoteInlineT[] }) {
  return runs.map((run, index) =>
    run.isBold ? <strong key={index}>{run.text}</strong> : <span key={index}>{run.text}</span>,
  )
}

export function InvestmentNoteBody({ note }: { note: string | undefined }) {
  const blocks = note ? parseNoteMarkdown(note) : []
  if (!blocks.length) return <div>—</div>

  return (
    <div className="flex flex-col gap-2">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          return (
            <h3 key={index} className="mt-2 border-b pb-1 font-semibold first:mt-0">
              <Inline runs={block.content} />
            </h3>
          )
        }
        if (block.kind === 'list') {
          return (
            <ul key={index} className="list-disc space-y-0.5 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <Inline runs={item} />
                </li>
              ))}
            </ul>
          )
        }
        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 && <br />}
                <Inline runs={line} />
              </span>
            ))}
          </p>
        )
      })}
    </div>
  )
}
