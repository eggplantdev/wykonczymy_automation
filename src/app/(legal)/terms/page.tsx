export default function TermsOfServicePage() {
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Regulamin</h1>

      <p className="mb-4">
        Niniejszy regulamin określa zasady korzystania z formularzy kontaktowych Wykończymy, w tym
        formularzy reklamowych Facebook Lead Ads.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Zakres usług</h2>
      <p className="mb-4">
        Wykończymy świadczy usługi remontowo-wykończeniowe. Przesłanie formularza kontaktowego
        stanowi zapytanie ofertowe i nie jest równoznaczne z zawarciem umowy.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Dane kontaktowe</h2>
      <p className="mb-4">
        Podając dane w formularzu, wyrażasz zgodę na kontakt w celu przedstawienia oferty. Zasady
        przetwarzania danych opisuje{' '}
        <a className="underline" href="/privacy">
          Polityka prywatności
        </a>
        .
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Kontakt</h2>
      <p>
        Pytania dotyczące regulaminu kieruj na adres{' '}
        <a className="underline" href="mailto:kontakt@wykonczymy.pl">
          kontakt@wykonczymy.pl
        </a>
        .
      </p>
    </main>
  )
}
