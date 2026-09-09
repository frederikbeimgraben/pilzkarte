import { istProblemDetail } from './problem';

describe('istProblemDetail', () => {
  it('erkennt einen Fehlerkörper nach RFC 9457', () => {
    expect(istProblemDetail({ type: 'about:blank', title: 'Nicht gefunden', status: 404 })).toBe(true);
  });

  it('weist alles andere ab', () => {
    expect(istProblemDetail(null)).toBe(false);
    expect(istProblemDetail('Fehler')).toBe(false);
    expect(istProblemDetail({ detail: 'Not Found' })).toBe(false);
    expect(istProblemDetail({ title: 'Nicht gefunden' })).toBe(false);
  });
});
