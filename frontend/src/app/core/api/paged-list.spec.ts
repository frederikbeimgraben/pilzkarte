import { of, throwError } from 'rxjs';
import type { Page } from './models';
import { PAGE_SIZE, PagedList } from './paged-list';

function page(entries: string[], gesamt: number, offset: number): Page<string> {
  return { eintraege: entries, gesamt, limit: PAGE_SIZE, offset };
}

describe('PagedList', () => {
  it('holt die erste Seite und meldet, dass mehr da ist', () => {
    const list = new PagedList<string>((offset) => of(page(['a', 'b'], 5, offset)));

    expect(list.loaded()).toBe(false);
    list.restart();

    expect(list.entries()).toEqual(['a', 'b']);
    expect(list.total()).toBe(5);
    expect(list.more()).toBe(true);
  });

  it('hängt die nächste Seite ans Ende', () => {
    const calls: number[] = [];
    const list = new PagedList<string>((offset) => {
      calls.push(offset);
      return of(page(offset === 0 ? ['a', 'b'] : ['c'], 3, offset));
    });

    list.restart();
    list.next();

    expect(calls).toEqual([0, 2]);
    expect(list.entries()).toEqual(['a', 'b', 'c']);
    expect(list.more()).toBe(false);
  });

  it('fängt bei einem Neustart von vorn an', () => {
    const calls: number[] = [];
    const list = new PagedList<string>((offset) => {
      calls.push(offset);
      return of(page(['a'], 2, offset));
    });

    list.restart();
    list.next();
    list.restart();

    expect(calls).toEqual([0, 1, 0]);
    expect(list.entries()).toEqual(['a']);
  });

  it('nimmt eine Zeile heraus und zählt sie ab', () => {
    const list = new PagedList<string>((offset) => of(page(['a', 'b'], 7, offset)));
    list.restart();

    list.withoutEntry((entry) => entry === 'a');

    expect(list.entries()).toEqual(['b']);
    expect(list.total()).toBe(6);
  });

  it('lässt stehen, was schon da ist, wenn eine Seite ausfällt', () => {
    let fail = false;
    const list = new PagedList<string>((offset) =>
      fail ? throwError(() => new Error('kaputt')) : of(page(['a'], 4, offset)),
    );
    list.restart();

    fail = true;
    list.next();

    expect(list.entries()).toEqual(['a']);
    expect(list.busy()).toBe(false);
  });
});
