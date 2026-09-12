import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import type { Background } from '../../map/background';
import { LayersSheetComponent } from './layers-sheet.component';

describe('EbenenBlattComponent', () => {
  it('zeigt die Hintergründe, was noch fehlt, und die Deckkraft', async () => {
    const { container } = await render(LayersSheetComponent, {
      inputs: { background: 'automatisch' as Background, opacity: 0.7 },
    });

    expect(screen.getByRole('dialog', { name: 'Auf der Karte' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'System' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Topografisch' })).toBeDisabled();
    expect(screen.getByText('Topografisch und Satellit kommen später.')).toBeInTheDocument();
    expect(screen.getByText('70 %')).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet Hintergrund und Deckkraft', async () => {
    const { fixture } = await render(LayersSheetComponent, {
      inputs: { background: 'automatisch' as Background, opacity: 1 },
    });
    const backgrounds: Background[] = [];
    const opacity: number[] = [];
    fixture.componentInstance.backgroundChange.subscribe((choice) => backgrounds.push(choice));
    fixture.componentInstance.opacityChange.subscribe((value) => opacity.push(value));

    await userEvent.click(screen.getByRole('tab', { name: 'Dunkel' }));
    fireEvent.input(screen.getByRole('slider', { name: /Deckkraft/ }), { target: { value: '40' } });

    expect(backgrounds).toEqual(['dunkel']);
    expect(opacity[0]).toBeCloseTo(0.4);
  });

  it('lässt die gesperrte Wahl nicht zu', async () => {
    const { fixture } = await render(LayersSheetComponent, {
      inputs: { background: 'hell' as Background, opacity: 1 },
    });
    const backgrounds: Background[] = [];
    fixture.componentInstance.backgroundChange.subscribe((choice) => backgrounds.push(choice));

    await userEvent.click(screen.getByRole('tab', { name: 'Satellit' }));

    expect(backgrounds).toEqual([]);
  });

  it('bietet die Vorhersage darunter nur in der Darstellung Ebene', async () => {
    const { rerender } = await render(LayersSheetComponent, {
      inputs: { background: 'hell' as Background, opacity: 1, showsLayer: false },
    });

    expect(screen.queryByRole('checkbox', { name: 'Vorhersage darunter zeigen' })).not.toBeInTheDocument();

    await rerender({ inputs: { background: 'hell' as Background, opacity: 1, showsLayer: true } });

    expect(screen.getByRole('checkbox', { name: 'Vorhersage darunter zeigen' })).toBeInTheDocument();
  });

  it('schaltet Marker, Zonen und geteilte Funde', async () => {
    const { fixture } = await render(LayersSheetComponent, {
      inputs: { background: 'hell' as Background, opacity: 1 },
    });
    const toggled: string[] = [];
    fixture.componentInstance.showMarkersChange.subscribe((an) => toggled.push(`marker:${an}`));
    fixture.componentInstance.showZonesChange.subscribe((an) => toggled.push(`zonen:${an}`));
    fixture.componentInstance.showSharedFindsChange.subscribe((an) => toggled.push(`funde:${an}`));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Meine Marker' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Zonen' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Geteilte Funde' }));

    expect(toggled).toEqual(['marker:false', 'zonen:false', 'funde:false']);
  });

  it('schließt über die Fußleiste', async () => {
    const { fixture } = await render(LayersSheetComponent, {
      inputs: { background: 'hell' as Background, opacity: 1 },
    });
    let closed = 0;
    fixture.componentInstance.closed.subscribe(() => (closed += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Fertig' }));

    expect(closed).toBe(1);
  });
});
