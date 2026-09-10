import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { OBJEKT_FARBEN } from '../../ui';
import { farbFelder, farbeAusHex, farbeHex } from './farben';

describe('Farben', () => {
  it('bildet jede Farbe des Vertrags auf ihren Wert ab und zurück', () => {
    expect(farbeHex('gruen')).toBe(OBJEKT_FARBEN[0]);
    expect(farbeHex('grau')).toBe(OBJEKT_FARBEN[5]);
    expect(farbeAusHex(OBJEKT_FARBEN[2])).toBe('blau');
  });

  it('fällt auf Grün zurück, wenn eine Farbe unbekannt ist', () => {
    expect(farbeHex('lila' as 'gruen')).toBe(OBJEKT_FARBEN[0]);
    expect(farbeAusHex('#123456')).toBe('gruen');
  });

  it('gibt jedem Farbfeld einen Namen für den Bildschirmleser', () => {
    const felder = farbFelder(TestBed.inject(I18nService));

    expect(felder).toHaveLength(6);
    expect(felder[0]).toEqual({ wert: OBJEKT_FARBEN[0], label: 'Grün' });
  });
});
