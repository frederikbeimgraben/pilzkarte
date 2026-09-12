/**
 * Das Raster, auf dem ein grober Ort liegt.
 *
 * Der Dienst rundet, bevor er speichert; hier steht nur, wie die Zahl gelesen
 * und beschriftet wird. Beide Seiten nennen dieselbe Maschenweite, sonst
 * verspräche die Oberfläche etwas anderes als die Datenbank hält.
 */

/** Maschenweite in Kilometern, wie `shared/geometry.GRID_KM` im Backend. */
export const GRID_KM = 5;

/**
 * Zwei Nachkommastellen sind gut einen Kilometer. Vier wären eine Genauigkeit,
 * die ein gerundeter Ort nicht hat.
 */
export const COARSE_DIGITS = 2;
