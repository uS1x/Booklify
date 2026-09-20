/**
 * Zuschneiden wie ein Dokumentenscanner – ohne Bildbibliothek.
 *
 * Schritt 1: Die Kanten des Buches im Foto schätzen (Sobel-Gradienten, danach
 * Projektionen auf X- und Y-Achse).
 * Schritt 2: Das aufgezogene Viereck perspektivisch entzerren (Homographie +
 * bilineare Abtastung), sodass ein gerades, rechteckiges Cover entsteht.
 */

export type Point = { x: number; y: number };
/** Reihenfolge immer: oben-links, oben-rechts, unten-rechts, unten-links. */
export type Quad = [Point, Point, Point, Point];

export const MAX_SOURCE_EDGE = 2000;
export const MAX_OUTPUT_EDGE = 1400;

/** Bilddatei in ein Canvas laden, dabei sehr große Fotos verkleinern. */
export async function loadImage(file: File | Blob, maxEdge = MAX_SOURCE_EDGE) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

/**
 * Schätzt die Buchkanten. Gesucht werden je eine starke senkrechte Kante links
 * und rechts sowie eine starke waagerechte Kante oben und unten. Das liefert
 * ein achsenparalleles Rechteck, das die Ecken anschließend feinjustieren.
 */
/**
 * Schätzt die Buchkanten. Maßgeblich ist der Farbabstand zum Untergrund, nicht
 * die Kantenstärke: Auf dem Cover selbst (Titelzeilen, Grafiken) sitzen oft
 * weit kräftigere Kanten als am Übergang zum Tisch, und ein farbiges Cover kann
 * dieselbe Helligkeit haben wie der Untergrund.
 */
export function detectCoverQuad(canvas: HTMLCanvasElement): Quad {
  const { width: w, height: h } = canvas;
  // Ohne erkennbares Buch bleibt das Bild unangetastet – wer ein fertiges
  // Cover auswählt, soll es nicht ungefragt beschnitten bekommen.
  const fallback = (): Quad => [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  if (w < 32 || h < 32) return fallback();

  // Verkleinerte Arbeitskopie – schnell und unempfindlich gegen Bildrauschen.
  const scale = Math.min(1, 320 / Math.max(w, h));
  const sw = Math.max(16, Math.round(w * scale));
  const sh = Math.max(16, Math.round(h * scale));
  const small = document.createElement("canvas");
  small.width = sw;
  small.height = sh;
  const context = small.getContext("2d", { willReadFrequently: true });
  if (!context) return fallback();
  context.drawImage(canvas, 0, 0, sw, sh);
  const { data } = context.getImageData(0, 0, sw, sh);

  /**
   * Farbton statt Farbe vergleichen: Maserung, Schattenverlauf und
   * Bildrauschen verändern vor allem die Helligkeit und heben sich im
   * normierten Farbanteil (r/(r+g+b)) weitgehend auf.
   */
  const feature = (i: number) => {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const sum = r + g + b || 1;
    return { cr: r / sum, cg: g / sum, brightness: sum / 765 };
  };
  const difference = (a: ReturnType<typeof feature>, b: ReturnType<typeof feature>) =>
    (Math.abs(a.cr - b.cr) + Math.abs(a.cg - b.cg)) * 2.5 + Math.abs(a.brightness - b.brightness);

  // Untergrund aus dem Bildrand schätzen (Median je Merkmal).
  const ring = Math.max(2, Math.round(Math.min(sw, sh) * 0.04));
  const borderPixels: ReturnType<typeof feature>[] = [];
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (x >= ring && x < sw - ring && y >= ring && y < sh - ring) continue;
      borderPixels.push(feature((y * sw + x) * 4));
    }
  }
  if (!borderPixels.length) return fallback();

  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? 0;
  };
  const background = {
    cr: median(borderPixels.map((p) => p.cr)),
    cg: median(borderPixels.map((p) => p.cg)),
    brightness: median(borderPixels.map((p) => p.brightness)),
  };

  // Rauschmaß des Untergrunds bestimmt den Schwellwert.
  const noise = median(borderPixels.map((p) => difference(p, background)));
  const threshold = Math.max(0.08, noise * 4);

  // Alles, was sich deutlich vom Untergrund unterscheidet, gilt als Buch.
  const columns = new Float32Array(sw);
  const rows = new Float32Array(sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      if (difference(feature((y * sw + x) * 4), background) > threshold) {
        columns[x]++;
        rows[y]++;
      }
    }
  }

  /**
   * Erste und letzte Spalte/Zeile, die zum Buch gehören. Die Schwelle liegt
   * bewusst niedrig, damit bei schräg liegenden Büchern auch die Ecken noch
   * im Rahmen landen; ein geglättetes Profil hält Rauschen draußen.
   */
  const bounds = (profile: Float32Array, span: number) => {
    const smooth = new Float32Array(profile.length);
    for (let i = 0; i < profile.length; i++) {
      const previous = profile[Math.max(0, i - 1)];
      const next = profile[Math.min(profile.length - 1, i + 1)];
      smooth[i] = (previous + profile[i] + next) / 3;
    }
    profile = smooth;

    let peak = 0;
    for (const value of profile) peak = Math.max(peak, value);
    if (peak < span * 0.3) return null;
    const limit = peak * 0.12;
    let first = -1;
    let last = -1;
    for (let i = 0; i < profile.length; i++) {
      if (profile[i] >= limit) {
        if (first < 0) first = i;
        last = i;
      }
    }
    return first >= 0 && last > first ? { first, last } : null;
  };

  const horizontal = bounds(columns, sh);
  const vertical = bounds(rows, sw);
  if (!horizontal || !vertical) return fallback();

  const x0 = (horizontal.first / sw) * w;
  const x1 = ((horizontal.last + 1) / sw) * w;
  const y0 = (vertical.first / sh) * h;
  const y1 = ((vertical.last + 1) / sh) * h;
  if (x1 - x0 < w * 0.15 || y1 - y0 < h * 0.15) return fallback();

  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/* ── Homographie ──────────────────────────────────────────────────────────── */

/** Löst ein lineares Gleichungssystem per Gauß-Elimination mit Spaltenpivot. */
function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col] / a[col][col];
      for (let k = col; k <= n; k++) a[row][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/**
 * Homographie, die die vier Zielecken (Rechteck) auf die vier Quellecken
 * abbildet – so lässt sich das Ergebnis Pixel für Pixel aus dem Foto abtasten.
 */
function homography(destination: Quad, source: Quad) {
  const matrix: number[][] = [];
  const vector: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = destination[i];
    const { x: u, y: v } = source[i];
    matrix.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    vector.push(u);
    matrix.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    vector.push(v);
  }
  const solution = solve(matrix, vector);
  return solution ? [...solution, 1] : null;
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Ausgabegröße aus den Kantenlängen des Vierecks – behält die Proportionen. */
export function outputSize(quad: Quad) {
  const width = (distance(quad[0], quad[1]) + distance(quad[3], quad[2])) / 2;
  const height = (distance(quad[0], quad[3]) + distance(quad[1], quad[2])) / 2;
  const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(width, height));
  return {
    width: Math.max(32, Math.round(width * scale)),
    height: Math.max(32, Math.round(height * scale)),
  };
}

/** Entzerrt das Viereck zu einem geraden Rechteck (bilineare Abtastung). */
export function warpQuad(source: HTMLCanvasElement, quad: Quad): HTMLCanvasElement {
  const { width, height } = outputSize(quad);
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;

  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const targetContext = target.getContext("2d");
  if (!sourceContext || !targetContext) return target;

  const destination: Quad = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const h = homography(destination, quad);
  if (!h) return target;

  const input = sourceContext.getImageData(0, 0, source.width, source.height);
  const output = targetContext.createImageData(width, height);
  const sw = source.width;
  const sh = source.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const denominator = h[6] * x + h[7] * y + h[8];
      const sx = (h[0] * x + h[1] * y + h[2]) / denominator;
      const sy = (h[3] * x + h[4] * y + h[5]) / denominator;
      const target4 = (y * width + x) * 4;

      if (sx < 0 || sy < 0 || sx > sw - 1 || sy > sh - 1) {
        output.data[target4 + 3] = 255;
        continue;
      }

      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, sw - 1);
      const y1 = Math.min(y0 + 1, sh - 1);
      const fx = sx - x0;
      const fy = sy - y0;

      for (let channel = 0; channel < 3; channel++) {
        const p00 = input.data[(y0 * sw + x0) * 4 + channel];
        const p10 = input.data[(y0 * sw + x1) * 4 + channel];
        const p01 = input.data[(y1 * sw + x0) * 4 + channel];
        const p11 = input.data[(y1 * sw + x1) * 4 + channel];
        output.data[target4 + channel] =
          p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy;
      }
      output.data[target4 + 3] = 255;
    }
  }

  targetContext.putImageData(output, 0, 0);
  return target;
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.88) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}
