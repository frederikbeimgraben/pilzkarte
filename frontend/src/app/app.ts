import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SignInSheetComponent } from './features/account/signin-sheet.component';
import { ShellComponent } from './shell/shell.component';
import { ToastComponent } from './ui/toast/toast.component';

/** Die Wurzel der App: die Hülle mit Navigation, darin die Reiter. */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SignInSheetComponent, ShellComponent, ToastComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {}
