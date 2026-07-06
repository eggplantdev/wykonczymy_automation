export default function DataDeletionPage() {
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Usuwanie danych</h1>

      <p className="mb-4">
        Jeśli chcesz, aby Twoje dane osobowe przekazane za pośrednictwem formularza kontaktowego (w
        tym formularza Facebook Lead Ads) zostały usunięte, postępuj zgodnie z poniższą instrukcją.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Jak usunąć swoje dane</h2>
      <p className="mb-4">
        Wyślij wiadomość e-mail na adres{' '}
        <a className="underline" href="mailto:kontakt@wykonczymy.pl">
          kontakt@wykonczymy.pl
        </a>{' '}
        z tematem „Usunięcie danych” oraz adresem e-mail lub numerem telefonu użytym w formularzu.
        Usuniemy Twoje dane w ciągu 30 dni i potwierdzimy to zwrotnie.
      </p>

      <p>
        Więcej informacji o przetwarzaniu danych znajdziesz w{' '}
        <a className="underline" href="/privacy">
          Polityce prywatności
        </a>
        .
      </p>
    </main>
  )
}
