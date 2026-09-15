/** Typen für die `.mjs`-Werkzeuge aus den Tests unter `src/tools`. */

declare module '*/tools/check-comments.mjs' {
  export interface Violation {
    path: string;
    line: number;
    rule: string;
    text: string;
    reason: string;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
  export function allowKey(violation: Violation): string;
}

declare module '*/tools/check-german.mjs' {
  export interface Violation {
    path: string;
    line: number;
    text: string;
  }
  export function isGerman(text: string): boolean;
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
  export function allowKey(violation: Violation): string;
}

declare module '*/tools/check-selectors.mjs' {
  export interface Violation {
    path: string;
    line: number;
    key: string;
    reason: string;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
}

declare module '*/tools/check-size.mjs' {
  export interface Violation {
    path: string;
    lines: number;
    limit: number;
  }
  export function findViolations(root: string): Violation[];
  export function report(root: string, allowPath: string): Violation[];
}

declare module '*/tools/check-boards.mjs' {
  export interface CardCoverage {
    checked: number;
    pending: string[];
    lost: string[];
    extra: string[];
  }
  export interface BoardCoverage {
    checked: string[];
    pending: string[];
    missing: string[];
    cards: CardCoverage;
  }
  export function checkBoards(root: string): BoardCoverage;
}

declare module '*/tools/sync-texts.mjs' {
  export function sorted(
    source: Record<string, Record<string, string>>,
  ): Record<string, Record<string, string>>;
  export function catalogue(): Record<string, Record<string, string>>;
}

declare module '*/tools/sync-boards.mjs' {
  export interface BoardFile {
    name: string;
    action: 'copy' | 'skip-same' | 'skip-excluded';
  }
  export interface CopyResult {
    fresh: number;
    same: number;
    files: BoardFile[];
  }
  export interface SyncResult extends CopyResult {
    from: string;
    target: string;
    /** Wo die Kartenbilder lagen, oder `null`, wenn es keine gibt. */
    fixtureSource: string | null;
    fixtures: CopyResult;
    /** Was aus `Blocks.png` geschnitten wurde, oder `null` ohne Manifest. */
    cards: { fresh: number; same: number; stale: number } | null;
  }
  export function sync(root: string): SyncResult | null;
  export function cardStem(selector: string): string;
}

declare module '*/tools/png.mjs' {
  export interface Raster {
    width: number;
    height: number;
    pixels: Buffer;
  }
  export function decode(file: Buffer): Raster;
  export function encode(raster: Raster): Buffer;
  export function crop(image: Raster, box: { x: number; y: number; w: number; h: number }): Raster;
}
