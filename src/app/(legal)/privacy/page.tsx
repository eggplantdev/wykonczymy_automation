export default function PrivacyPolicyPage() {
  return (
    <main>
      <h1 className="mb-6 text-2xl font-semibold">Polityka prywatności</h1>

      <p className="mb-4">
        Niniejsza polityka opisuje, w jaki sposób Wykończymy przetwarza dane osobowe przekazane za
        pośrednictwem formularzy kontaktowych, w tym formularzy reklamowych Facebook Lead Ads.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Jakie dane zbieramy</h2>
      <p className="mb-4">
        Zbieramy dane, które podajesz w formularzu kontaktowym: imię i nazwisko, adres e-mail, numer
        telefonu oraz treść zapytania.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Cel przetwarzania</h2>
      <p className="mb-4">
        Dane wykorzystujemy wyłącznie w celu kontaktu z Tobą oraz przygotowania oferty na usługi
        remontowo-wykończeniowe. Nie sprzedajemy ani nie udostępniamy Twoich danych podmiotom
        trzecim w celach marketingowych.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Okres przechowywania</h2>
      <p className="mb-4">
        Dane przechowujemy przez czas niezbędny do obsługi zapytania oraz realizacji ewentualnej
        umowy, a następnie usuwamy je zgodnie z obowiązującymi przepisami.
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Twoje prawa</h2>
      <p className="mb-4">
        Masz prawo dostępu do swoich danych, ich sprostowania oraz usunięcia. Aby usunąć swoje dane,
        zapoznaj się z instrukcją na stronie{' '}
        <a className="underline" href="/data-deletion">
          Usuwanie danych
        </a>
        .
      </p>

      <h2 className="mt-8 mb-2 text-lg font-semibold">Kontakt</h2>
      <p>
        W sprawach dotyczących danych osobowych napisz na adres:{' '}
        <a className="underline" href="mailto:kontakt@wykonczymy.pl">
          kontakt@wykonczymy.pl
        </a>
        .
      </p>
    </main>
  )
}
