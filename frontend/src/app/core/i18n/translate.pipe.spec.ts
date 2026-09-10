import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  imports: [TranslatePipe],
  template: '<p>{{ "nav.arten" | t }}</p>',
})
class HostComponent {}

describe('TranslatePipe', () => {
  it('übersetzt und folgt einem Sprachwechsel', async () => {
    const { fixture } = await render(HostComponent);

    expect(screen.getByText('Arten')).toBeInTheDocument();

    TestBed.inject(I18nService).setLocale('en');
    fixture.detectChanges();

    expect(screen.getByText('Species')).toBeInTheDocument();
  });
});
