import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { OBJECT_COLORS } from '../../ui';
import { colorSwatches, colorFromHex, colorHex } from './colors';

describe('Farben', () => {
  it('bildet jede Farbe des Vertrags auf ihren Wert ab und zurück', () => {
    expect(colorHex('gruen')).toBe(OBJECT_COLORS[0]);
    expect(colorHex('grau')).toBe(OBJECT_COLORS[5]);
    expect(colorFromHex(OBJECT_COLORS[2])).toBe('blau');
  });

  it('fällt auf Grün zurück, wenn eine Farbe unbekannt ist', () => {
    expect(colorHex('lila' as 'gruen')).toBe(OBJECT_COLORS[0]);
    expect(colorFromHex('#123456')).toBe('gruen');
  });

  it('gibt jedem Farbfeld einen Namen für den Bildschirmleser', () => {
    const fields = colorSwatches(TestBed.inject(I18nService));

    expect(fields).toHaveLength(6);
    expect(fields[0]).toEqual({ value: OBJECT_COLORS[0], label: 'Grün' });
  });
});
