import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { LevelPillComponent } from './level-pill.component';

describe('LevelPillComponent', () => {
  it('trägt das Wort und seine eigene Farbe', async () => {
    const { container } = await render(LevelPillComponent, {
      inputs: { text: 'tödlich giftig', colour: '#d2685f' },
    });

    expect(screen.getByText('tödlich giftig')).toBeInTheDocument();
    const pill = container.querySelector<HTMLElement>('.level');
    expect(pill?.style.getPropertyValue('--pilz-level-colour')).toBe('#d2685f');
    await noViolations(container);
  });
});
