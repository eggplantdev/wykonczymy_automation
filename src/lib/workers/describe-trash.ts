export function describeWorkerTrash(name: string, registerNames: string[]): string {
  const withRegisters =
    registerNames.length === 0
      ? ''
      : ` Razem z nim ${registerNames.length === 1 ? 'kasa' : 'kasy'}: ${registerNames.join(', ')}.`
  return `Przenieść „${name}" do kosza? Nie zaloguje się, dopóki go nie przywrócisz.${withRegisters}`
}
