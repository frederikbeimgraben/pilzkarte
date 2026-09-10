import { isProblemDetail } from './problem';

describe('istProblemDetail', () => {
  it('erkennt einen Fehlerkörper nach RFC 9457', () => {
    expect(isProblemDetail({ type: 'about:blank', title: 'Nicht gefunden', status: 404 })).toBe(true);
  });

  it('weist alles andere ab', () => {
    expect(isProblemDetail(null)).toBe(false);
    expect(isProblemDetail('Fehler')).toBe(false);
    expect(isProblemDetail({ detail: 'Not Found' })).toBe(false);
    expect(isProblemDetail({ title: 'Nicht gefunden' })).toBe(false);
  });
});
