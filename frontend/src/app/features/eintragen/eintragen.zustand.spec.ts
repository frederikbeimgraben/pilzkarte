import { TestBed } from '@angular/core/testing';
import { EintragenZustand } from './eintragen.zustand';

function zustand(): EintragenZustand {
  return TestBed.inject(EintragenZustand);
}

describe('EintragenZustand', () => {
  it('beginnt beim Aktionsblatt und dunkelt die Karte ab', () => {
    const ablauf = zustand();

    ablauf.oeffne();

    expect(ablauf.schritt()).toBe('aktionen');
    expect(ablauf.laeuft()).toBe(true);
    expect(ablauf.dunkel()).toBe(true);
    expect(ablauf.zeigtFadenkreuz()).toBe(false);
  });

  it('führt vom Fundort ins Fund-Formular', () => {
    const ablauf = zustand();

    ablauf.beginneFund();
    expect(ablauf.zeigtFadenkreuz()).toBe(true);
    expect(ablauf.dunkel()).toBe(false);
    ablauf.uebernimmOrt([9.05, 48.52]);

    expect(ablauf.schritt()).toBe('fundFormular');
    expect(ablauf.ort()).toEqual([9.05, 48.52]);
  });

  it('führt vom Marker-Ort ins Marker-Formular', () => {
    const ablauf = zustand();

    ablauf.beginneMarker();
    ablauf.uebernimmOrt([9.06, 48.53]);

    expect(ablauf.schritt()).toBe('markerFormular');
  });

  it('sammelt Eckpunkte und nimmt den letzten wieder weg', () => {
    const ablauf = zustand();

    ablauf.beginneZone();
    ablauf.setzeEckpunkt([9.0, 48.5]);
    ablauf.setzeEckpunkt([9.1, 48.5]);
    ablauf.entferneLetztenEckpunkt();

    expect(ablauf.ring()).toEqual([[9.0, 48.5]]);
    expect(ablauf.ringGeschlossen()).toBe(false);
  });

  it('schließt eine Zone erst ab drei Eckpunkten', () => {
    const ablauf = zustand();
    ablauf.beginneZone();
    ablauf.setzeEckpunkt([9.0, 48.5]);
    ablauf.setzeEckpunkt([9.1, 48.5]);

    expect(ablauf.schliesseZone()).toBe(false);

    ablauf.setzeEckpunkt([9.1, 48.6]);

    expect(ablauf.schliesseZone()).toBe(true);
    expect(ablauf.schritt()).toBe('zoneFormular');
  });

  it('übernimmt einen Ring, den Terra Draw verschoben hat', () => {
    const ablauf = zustand();
    ablauf.beginneZone();

    ablauf.setzeRing([
      [9.0, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);

    expect(ablauf.ring()).toHaveLength(3);
  });

  it('geht aus jedem Formular auf seinen Schritt davor zurück', () => {
    const ablauf = zustand();

    ablauf.beginneFund();
    ablauf.uebernimmOrt([9, 48]);
    ablauf.zurueck();
    expect(ablauf.schritt()).toBe('fundOrt');

    ablauf.beginneMarker();
    ablauf.uebernimmOrt([9, 48]);
    ablauf.zurueck();
    expect(ablauf.schritt()).toBe('markerOrt');

    ablauf.beginneZone();
    ablauf.setzeRing([
      [9, 48],
      [9.1, 48],
      [9.1, 48.1],
    ]);
    ablauf.schliesseZone();
    ablauf.zurueck();
    expect(ablauf.schritt()).toBe('zoneZeichnen');

    ablauf.zurueck();
    expect(ablauf.schritt()).toBeNull();
  });

  it('räumt beim Beenden Ort und Eckpunkte weg', () => {
    const ablauf = zustand();
    ablauf.beginneZone();
    ablauf.setzeEckpunkt([9, 48]);

    ablauf.beende();

    expect(ablauf.schritt()).toBeNull();
    expect(ablauf.ring()).toEqual([]);
    expect(ablauf.ort()).toBeNull();
  });
});
