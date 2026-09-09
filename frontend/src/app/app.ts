import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ToastComponent } from '@stupa-makers/ui-kit';
import { ShellComponent } from './shell/shell.component';

/** Die Wurzel der App: die Hülle mit Navigation, darin die Reiter. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ShellComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
