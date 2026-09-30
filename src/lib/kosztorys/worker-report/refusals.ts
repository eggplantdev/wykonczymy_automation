// Shared by the report page (a notice instead of the form) and `tokenAction` (a refused send from a
// page opened before the state changed), so the worker reads the same sentence either way.
export const REPORT_REFUSALS = {
  unknownToken: 'Ten link wygasł albo został cofnięty. Poproś kierownika o nowy.',
  // The gate's own sentences tell a kierownik to reopen the investment — a control the worker has not got.
  closed: 'Ta inwestycja jest zamknięta — zgłoszenia prac nie są już przyjmowane.',
  template: 'Szablon nie przyjmuje zgłoszeń prac.',
  inactiveWorker: 'Twoje konto jest nieaktywne. Skontaktuj się z kierownikiem.',
  foreignItem: 'Część pozycji zniknęła z rozpiski. Odśwież stronę i sprawdź zgłoszenie.',
} as const
