/**
 * Fehlerkörper nach RFC 9457. Das Backend antwortet auf jedem Fehlerpfad mit
 * `application/problem+json`, nie mit dem FastAPI-`detail`.
 */
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  code?: string;
  errors?: { field: string; msg: string }[];
}

/** Prüft, ob ein Antwortkörper wirklich ein problem+json ist. */
export function istProblemDetail(wert: unknown): wert is ProblemDetail {
  if (typeof wert !== 'object' || wert === null) return false;
  const kandidat = wert as Partial<ProblemDetail>;
  return typeof kandidat.title === 'string' && typeof kandidat.status === 'number';
}
