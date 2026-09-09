import axe from 'axe-core';

/**
 * Prüft einen Ausschnitt der Seite mit axe. Seitenweite Regeln (Landmarken,
 * Sprache des Dokuments) gelten für einen einzelnen Baustein nicht; sie werden
 * auf der Seite geprüft, die ihn einsetzt.
 */
export async function keineVerstoesse(element: Element): Promise<void> {
  const ergebnis = await axe.run(element, {
    rules: {
      region: { enabled: false },
      'page-has-heading-one': { enabled: false },
      'landmark-one-main': { enabled: false },
    },
  });
  if (ergebnis.violations.length > 0) {
    const text = ergebnis.violations
      .map((verstoss) => `${verstoss.id}: ${verstoss.help} (${String(verstoss.nodes.length)})`)
      .join('\n');
    throw new Error(`axe hat Verstöße gefunden:\n${text}`);
  }
}
