// What the kierownik reviews, what the katalog is matched against and what an accepted extra lands
// as: the Polish once translated.
export const reviewedDescription = (line: {
  description: string
  polishDescription: string | null | undefined
}) => line.polishDescription ?? line.description
