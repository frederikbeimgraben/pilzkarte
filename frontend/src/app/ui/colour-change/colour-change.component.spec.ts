import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { ColourChangeComponent } from './colour-change.component';

const WHITE = [{ name: 'weiß', hex: '#f4efe2' }];
const BLUE = [{ name: 'blau', hex: '#3f6ea8' }];

describe('ColourChangeComponent', () => {
  it('stellt von, Pfeil, nach und die Dauer nebeneinander', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        from: WHITE,
        to: BLUE,
        fromLabel: 'Farbe: weiß',
        toLabel: 'Farbe: blau',
        duration: 'sofort',
        arrowLabel: 'wird zu',
      },
    });

    expect(screen.getByRole('img', { name: 'Farbe: weiß' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'wird zu' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Farbe: blau' })).toBeInTheDocument();
    expect(screen.getByText('sofort')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt den Pfeil weg, wenn die Farbe bleibt', async () => {
    await render(ColourChangeComponent, {
      inputs: {
        from: WHITE,
        to: [],
        fromLabel: 'Farbe: weiß',
        toLabel: '',
        duration: 'bleibt',
        arrowLabel: 'wird zu',
      },
    });

    expect(screen.queryByRole('img', { name: 'wird zu' })).not.toBeInTheDocument();
    expect(screen.getByText('bleibt')).toBeInTheDocument();
  });
});
