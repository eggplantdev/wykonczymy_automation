export const reviewedDescription = (line: {
  description: string
  polishDescription: string | null | undefined
}) => line.polishDescription ?? line.description
