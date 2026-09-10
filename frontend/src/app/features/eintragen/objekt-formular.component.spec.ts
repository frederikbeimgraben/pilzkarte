import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { keineVerstoesse } from '../../testing/axe';
import { OBJEKT_FARBEN } from '../../ui';
import { ObjektFormularComponent, type ObjektWerte } from './objekt-formular.component';

const BESCHRIFTUNGEN = {
  nameLabel: 'Name',
  namePlatzhalter: 'Name der Zone',
  nameFehltText: 'Gib der Zone einen Namen.',
};

describe('ObjektFormularComponent', () => {
  it('sammelt Name, Farbe, Sichtbarkeit und Notiz', async () => {
    const { fixture, container } = await render(ObjektFormularComponent, { inputs: BESCHRIFTUNGEN });

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('radio', { name: 'Blau' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.type(screen.getByLabelText('Notiz'), 'Nordhang');

    expect(fixture.componentInstance.werte()).toEqual({
      name: 'Schönbuch Nord',
      farbe: 'blau',
      notiz: 'Nordhang',
      sichtbarkeit: 'geteilt',
    });
    await keineVerstoesse(container);
  });

  it('gibt ohne Namen nichts her', async () => {
    const { fixture } = await render(ObjektFormularComponent, { inputs: BESCHRIFTUNGEN });

    expect(fixture.componentInstance.werte()).toBeNull();
  });

  it('füllt sich aus einem vorhandenen Objekt und lässt es ändern', async () => {
    const start: ObjektWerte = {
      name: 'Schönbuch Nord',
      farbe: 'rot',
      notiz: 'Alte Fichten',
      sichtbarkeit: 'geteilt',
    };
    const { fixture } = await render(ObjektFormularComponent, {
      inputs: { ...BESCHRIFTUNGEN, start },
    });

    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');
    expect(screen.getByRole('radio', { name: 'Rot' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Privat' }));

    expect(fixture.componentInstance.werte()?.sichtbarkeit).toBe('privat');
  });

  it('lässt das Namensfeld weg, wo der Name schon als Überschrift steht', async () => {
    const start: ObjektWerte = { name: 'Zone', farbe: 'gruen', notiz: null, sichtbarkeit: 'privat' };
    const { fixture } = await render(ObjektFormularComponent, {
      inputs: { ...BESCHRIFTUNGEN, ohneName: true, start },
    });

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(fixture.componentInstance.werte()?.name).toBe('Zone');
  });

  it('meldet jede Änderung, damit die Karte der Farbe folgen kann', async () => {
    const { fixture } = await render(ObjektFormularComponent, { inputs: BESCHRIFTUNGEN });
    const gemeldet: ObjektWerte[] = [];
    fixture.componentInstance.werteChange.subscribe((werte) => gemeldet.push(werte));

    await userEvent.click(screen.getByRole('radio', { name: 'Gold' }));

    expect(gemeldet.at(-1)?.farbe).toBe('gold');
    expect(OBJEKT_FARBEN).toContain('#876010');
  });
});
