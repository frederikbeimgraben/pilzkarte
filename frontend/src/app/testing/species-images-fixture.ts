import type { ImageSubmission, SpeciesImage } from '../core/api/models';

/** Ein freigegebenes Bild. Jedes Feld lässt sich einzeln überschreiben. */
export function speciesImage(override: Partial<SpeciesImage> = {}): SpeciesImage {
  const id = override.id ?? 'bild-eins';
  return {
    id,
    speciesSlug: 'steinpilz',
    photographer: 'Marie Weber',
    licence: 'cc-by-sa-4',
    source: null,
    takenOn: '2026-09-06',
    caption: null,
    lat: null,
    lon: null,
    lead: true,
    width: 1600,
    height: 1200,
    url: `/api/species-images/${id}/full`,
    thumbUrl: `/api/species-images/${id}/thumb`,
    ...override,
  };
}

/** Dasselbe Bild mit seinem Zustand, für „Meine Bilder“ und den Eingang. */
export function imageSubmission(override: Partial<ImageSubmission> = {}): ImageSubmission {
  return {
    ...speciesImage(override),
    state: 'submitted',
    rejectReason: null,
    submittedBy: 'Jonas Weber',
    submittedAt: '2026-09-09T08:00:00+02:00',
    lead: false,
    ...override,
  };
}
