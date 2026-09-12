/**
 * Der Vertrag der Artbilder, wie ihn
 * `backend/app/modules/species_images/schemas.py` festlegt.
 *
 * Die Felder sind englisch: die Tabelle und ihre Endpunkte sind neu und
 * mussten den Umweg über deutsche Namen nicht mitgehen.
 */

/**
 * Unter welchem Recht ein Bild steht. `own` heißt: die Person hat es selbst
 * aufgenommen und gibt es der App.
 */
export const LICENCES = ['own', 'cc0', 'cc-by-4', 'cc-by-sa-4', 'public-domain'] as const;
export type Licence = (typeof LICENCES)[number];

/** Wo ein Bild in der Prüfung steht. */
export const IMAGE_STATES = ['submitted', 'approved', 'rejected'] as const;
export type ImageState = (typeof IMAGE_STATES)[number];

/** Ein freigegebenes Bild, so wie es an der Art steht. */
export interface SpeciesImage {
  id: string;
  speciesSlug: string;
  photographer: string;
  licence: Licence;
  source: string | null;
  takenOn: string | null;
  caption: string | null;
  /** Das Titelbild der Art. Höchstens eines trägt es. */
  lead: boolean;
  width: number;
  height: number;
  /** Der fertige Pfad der großen Fassung. Der Client baut ihn nicht selbst. */
  url: string;
  thumbUrl: string;
}

/** Dasselbe Bild samt seinem Zustand, für „Meine Bilder“ und den Eingang. */
export interface ImageSubmission extends SpeciesImage {
  state: ImageState;
  rejectReason: string | null;
  submittedBy: string | null;
  submittedAt: string;
}
