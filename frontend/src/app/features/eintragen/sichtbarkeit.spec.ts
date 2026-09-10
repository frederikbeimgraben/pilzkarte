import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { sichtbarkeitSegmente, sichtbarkeitText } from './sichtbarkeit';

describe('Sichtbarkeit', () => {
  it('baut die zwei Segmente aus den Mockups', () => {
    expect(sichtbarkeitSegmente(TestBed.inject(I18nService))).toEqual([
      { wert: 'privat', label: 'Privat' },
      { wert: 'geteilt', label: 'Geteilt' },
    ]);
  });

  it('schreibt die Sichtbarkeit in der Unterzeile klein', () => {
    expect(sichtbarkeitText(TestBed.inject(I18nService), 'privat')).toBe('privat');
  });
});
