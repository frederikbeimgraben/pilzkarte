import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { RejectDialogComponent } from './reject-dialog.component';

interface Setup {
  container: Element;
  reasons: string[];
  closes: number;
  refresh: () => void;
}

async function build(person: string | null = 'Jonas Weber'): Promise<Setup> {
  const reasons: string[] = [];
  const state = { closes: 0 };
  const { container, fixture, detectChanges } = await render(RejectDialogComponent, {
    inputs: { open: true, person },
  });
  fixture.componentInstance.rejected.subscribe((reason: string) => reasons.push(reason));
  fixture.componentInstance.closed.subscribe(() => (state.closes += 1));
  detectChanges();
  return {
    container,
    reasons,
    get closes() {
      return state.closes;
    },
    refresh: detectChanges,
  };
}

describe('RejectDialogComponent', () => {
  it('fragt in einem eigenen Blatt nach dem Grund', async () => {
    const { container } = await build();

    expect(screen.getByRole('dialog', { name: 'Warum lehnst du ab?' })).toBeInTheDocument();
    expect(
      screen.getByText('Der Grund geht an Jonas Weber. Ohne Grund geht die Absage nicht hinaus.'),
    ).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt ohne Grund nicht ablehnen', async () => {
    const { reasons } = await build();

    const button = screen.getByRole('button', { name: 'Ablehnen' });
    expect(button).toBeDisabled();
    await userEvent.click(button);

    expect(reasons).toEqual([]);
  });

  it('nimmt einen Grund aus den Vorschlägen', async () => {
    const { reasons, refresh } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Art nicht erkennbar' }));
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));

    expect(reasons).toEqual(['Art nicht erkennbar']);
  });

  it('nimmt einen geschriebenen Grund und schneidet Leerzeichen ab', async () => {
    const { reasons, refresh } = await build();

    await userEvent.type(screen.getByLabelText('Grund'), '  Die Lamellen fehlen.  ');
    refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));

    expect(reasons).toEqual(['Die Lamellen fehlen.']);
  });

  it('meldet das Abbrechen und behält keinen Grund', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Grund'), 'Unscharf');
    setup.refresh();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    setup.refresh();

    expect(setup.closes).toBe(1);
    expect(screen.getByLabelText('Grund')).toHaveValue('');
  });

  it('kommt ohne Namen der Person aus', async () => {
    await build(null);

    expect(
      screen.getByText('Der Grund geht an die einreichende Person. Ohne Grund geht die Absage nicht hinaus.'),
    ).toBeInTheDocument();
  });
});
