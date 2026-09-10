import { TestBed } from '@angular/core/testing';
import { AddEntryState } from './add-entry.state';

function state(): AddEntryState {
  return TestBed.inject(AddEntryState);
}

describe('EintragenZustand', () => {
  it('beginnt beim Aktionsblatt und dunkelt die Karte ab', () => {
    const flow = state();

    flow.open();

    expect(flow.step()).toBe('aktionen');
    expect(flow.running()).toBe(true);
    expect(flow.dark()).toBe(true);
    expect(flow.showsCrosshair()).toBe(false);
  });

  it('führt vom Fundort ins Fund-Formular', () => {
    const flow = state();

    flow.startFind();
    expect(flow.showsCrosshair()).toBe(true);
    expect(flow.dark()).toBe(false);
    flow.adoptLocation([9.05, 48.52]);

    expect(flow.step()).toBe('fundFormular');
    expect(flow.location()).toEqual([9.05, 48.52]);
  });

  it('führt vom Marker-Ort ins Marker-Formular', () => {
    const flow = state();

    flow.startMarker();
    flow.adoptLocation([9.06, 48.53]);

    expect(flow.step()).toBe('markerFormular');
  });

  it('sammelt Eckpunkte und nimmt den letzten wieder weg', () => {
    const flow = state();

    flow.startZone();
    flow.addCorner([9.0, 48.5]);
    flow.addCorner([9.1, 48.5]);
    flow.removeLastCorner();

    expect(flow.ring()).toEqual([[9.0, 48.5]]);
    expect(flow.ringClosed()).toBe(false);
  });

  it('schließt eine Zone erst ab drei Eckpunkten', () => {
    const flow = state();
    flow.startZone();
    flow.addCorner([9.0, 48.5]);
    flow.addCorner([9.1, 48.5]);

    expect(flow.closeZone()).toBe(false);

    flow.addCorner([9.1, 48.6]);

    expect(flow.closeZone()).toBe(true);
    expect(flow.step()).toBe('zoneFormular');
  });

  it('übernimmt einen Ring, den Terra Draw verschoben hat', () => {
    const flow = state();
    flow.startZone();

    flow.setRing([
      [9.0, 48.5],
      [9.2, 48.5],
      [9.2, 48.7],
    ]);

    expect(flow.ring()).toHaveLength(3);
  });

  it('geht aus jedem Formular auf seinen Schritt davor zurück', () => {
    const flow = state();

    flow.startFind();
    flow.adoptLocation([9, 48]);
    flow.back();
    expect(flow.step()).toBe('fundOrt');

    flow.startMarker();
    flow.adoptLocation([9, 48]);
    flow.back();
    expect(flow.step()).toBe('markerOrt');

    flow.startZone();
    flow.setRing([
      [9, 48],
      [9.1, 48],
      [9.1, 48.1],
    ]);
    flow.closeZone();
    flow.back();
    expect(flow.step()).toBe('zoneZeichnen');

    flow.back();
    expect(flow.step()).toBeNull();
  });

  it('räumt beim Beenden Ort und Eckpunkte weg', () => {
    const flow = state();
    flow.startZone();
    flow.addCorner([9, 48]);

    flow.stop();

    expect(flow.step()).toBeNull();
    expect(flow.ring()).toEqual([]);
    expect(flow.location()).toBeNull();
  });
});
