// Shared by the report page (a notice instead of the form) and `tokenAction` (a refused send from a
// page opened before the state changed), so the worker reads the same sentence either way.
export const REPORT_REFUSALS = {
  unknownToken: 'Ten link wygasł albo został cofnięty. Poproś kierownika o nowy.',
  // The gate's own sentences tell a kierownik to reopen the investment — a control the worker has not got.
  closed: 'Ta inwestycja jest zamknięta — zgłoszenia prac nie są już przyjmowane.',
  template: 'Szablon nie przyjmuje zgłoszeń prac.',
  inactiveWorker: 'Twoje konto jest nieaktywne. Skontaktuj się z kierownikiem.',
  foreignItem: 'Część prac zniknęła z rozpiski. Odśwież stronę i sprawdź zgłoszenie.',
} as const

// The review dialog blocks „Przyjmij" with the sentence the server would refuse it with.
export const ACCEPT_REFUSALS = {
  lostRecordedStage:
    'Część zgłoszenia przyjęto do etapu, którego już nie ma albo w którym nie ma już tego pracownika. Odznacz te prace, zanim dodasz resztę do innego etapu.',
  unsettledPlane:
    'Rozliczenie etapów tego pracownika nie jest ustalone — wybierz jeden z jego etapów.',
} as const
