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

/* ── Kantenerkennung ──────────────────────────────────────────────────────── */

type EdgeMap = { mask: Uint8Array; rgb: Uint8ClampedArray; width: number; height: number };

/** Graustufen, leichte Glättung, Sobel – behält nur die kräftigsten Kanten. */
function edgeMap(canvas: HTMLCanvasElement, targetEdge = 420): EdgeMap | null {
  const scale = Math.min(1, targetEdge / Math.max(canvas.width, canvas.height));
  const w = Math.max(32, Math.round(canvas.width * scale));
  const h = Math.max(32, Math.round(canvas.height * scale));

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const context = small.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(canvas, 0, 0, w, h);
  const { data } = context.getImageData(0, 0, w, h);
  const rgb = new Uint8ClampedArray(data);

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // 3×3-Mittelwert gegen Bildrauschen
  const blurred = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += gray[(y + dy) * w + x + dx];
      blurred[y * w + x] = sum / 9;
    }
  }

  const magnitude = new Float32Array(w * h);
  const direction = new Uint8Array(w * h);
  let max = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        blurred[i - w - 1] + 2 * blurred[i - 1] + blurred[i + w - 1] -
        (blurred[i - w + 1] + 2 * blurred[i + 1] + blurred[i + w + 1]);
      const gy =
        blurred[i - w - 1] + 2 * blurred[i - w] + blurred[i - w + 1] -
        (blurred[i + w - 1] + 2 * blurred[i + w] + blurred[i + w + 1]);
      magnitude[i] = Math.hypot(gx, gy);
      if (magnitude[i] > max) max = magnitude[i];

      const angle = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      direction[i] = angle < 22.5 || angle >= 157.5 ? 0 : angle < 67.5 ? 1 : angle < 112.5 ? 2 : 3;
    }
  }
  if (max < 1) return null;

  /**
   * Kanten ausdünnen: nur Punkte behalten, die quer zur Kantenrichtung ein
   * lokales Maximum sind. Ein detailreiches Cover erzeugt sonst breite
   * Kantenbänder, die die viel schwächere Außenkante des Buches überstimmen.
   */
  const thin = new Float32Array(w * h);
  const offsets: [number, number][] = [
    [1, 0],
    [1, -1],
    [0, 1],
    [1, 1],
  ];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const [dx, dy] = offsets[direction[i]];
      const a = magnitude[(y + dy) * w + x + dx];
      const b = magnitude[(y - dy) * w + x - dx];
      thin[i] = magnitude[i] >= a && magnitude[i] >= b ? magnitude[i] : 0;
    }
  }

  // Doppelte Schwelle mit Hysterese: schwache Kanten zählen mit, wenn sie an
  // einer starken hängen – so überlebt die durchgehende Kante des Buches.
  const values = Array.from(thin).filter((value) => value > 0).sort((a, b) => a - b);
  if (!values.length) return null;
  const high = values[Math.floor(values.length * 0.8)];
  const low = high * 0.3;

  const mask = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < thin.length; i++) {
    if (thin[i] >= high) {
      mask[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = (i - x) / w;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 1 || ny < 1 || nx >= w - 1 || ny >= h - 1) continue;
        const j = ny * w + nx;
        if (!mask[j] && thin[j] >= low) {
          mask[j] = 1;
          stack.push(j);
        }
      }
    }
  }

  return { mask, rgb, width: w, height: h };
}

type Line = { theta: number; rho: number; votes: number };

/**
 * Hough-Transformation: Jeder Kantenpunkt stimmt für alle Geraden ab, die durch
 * ihn laufen. Lange durchgehende Kanten – also die Buchränder – sammeln dadurch
 * viel mehr Stimmen als kurze Textzeilen auf dem Cover.
 */
function houghLines(edges: EdgeMap, angles: number[], keep: number): Line[] {
  const { mask, width: w, height: h } = edges;
  const diagonal = Math.ceil(Math.hypot(w, h));
  const rhoOffset = diagonal;
  const rhoSize = diagonal * 2 + 1;
  const accumulator = new Int32Array(angles.length * rhoSize);
  const cos = angles.map((a) => Math.cos((a * Math.PI) / 180));
  const sin = angles.map((a) => Math.sin((a * Math.PI) / 180));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let a = 0; a < angles.length; a++) {
        const rho = Math.round(x * cos[a] + y * sin[a]) + rhoOffset;
        accumulator[a * rhoSize + rho]++;
      }
    }
  }

  // Lokale Maxima einsammeln und ähnliche Geraden unterdrücken.
  const peaks: Line[] = [];
  for (let a = 0; a < angles.length; a++) {
    for (let rho = 1; rho < rhoSize - 1; rho++) {
      const votes = accumulator[a * rhoSize + rho];
      if (votes < 12) continue;
      if (votes < accumulator[a * rhoSize + rho - 1] || votes < accumulator[a * rhoSize + rho + 1]) continue;
      peaks.push({ theta: angles[a], rho: rho - rhoOffset, votes });
    }
  }
  peaks.sort((a, b) => b.votes - a.votes);

  // Geraden direkt am Bildrand stammen vom Foto selbst (Vignette, Rauschkante)
  // und nicht vom Buch – sonst gewinnt immer das ganze Bild.
  const border = Math.max(3, Math.min(w, h) * 0.025);
  const atBorder = (line: Line) => {
    const cos = Math.cos((line.theta * Math.PI) / 180);
    const sin = Math.sin((line.theta * Math.PI) / 180);
    // Abstand der Geraden zu den vier Bildkanten in ihrer Hauptrichtung
    const position = Math.abs(sin) > Math.abs(cos) ? line.rho / sin : line.rho / cos;
    const span = Math.abs(sin) > Math.abs(cos) ? h : w;
    return position < border || position > span - border;
  };

  const chosen: Line[] = [];
  for (const line of peaks) {
    if (atBorder(line)) continue;
    const tooClose = chosen.some(
      (other) => Math.abs(other.rho - line.rho) < Math.min(w, h) * 0.04 && Math.abs(other.theta - line.theta) < 20,
    );
    if (!tooClose) chosen.push(line);
    if (chosen.length >= keep) break;
  }
  return chosen;
}

/** Winkelabstand zweier Geraden in Grad (180° ≙ 0°). */
function angleGap(a: number, b: number) {
  const difference = Math.abs(a - b) % 180;
  return Math.min(difference, 180 - difference);
}

function intersect(a: Line, b: Line): Point | null {
  const a1 = Math.cos((a.theta * Math.PI) / 180);
  const b1 = Math.sin((a.theta * Math.PI) / 180);
  const a2 = Math.cos((b.theta * Math.PI) / 180);
  const b2 = Math.sin((b.theta * Math.PI) / 180);
  const determinant = a1 * b2 - a2 * b1;
  if (Math.abs(determinant) < 1e-6) return null;
  return {
    x: (a.rho * b2 - b.rho * b1) / determinant,
    y: (a2 * a.rho * -1 + a1 * b.rho) / determinant,
  };
}

/** Anteil der Strecke, der tatsächlich auf erkannten Kanten liegt. */
function segmentSupport(edges: EdgeMap, from: Point, to: Point) {
  const steps = Math.max(8, Math.round(Math.hypot(to.x - from.x, to.y - from.y)));
  let hits = 0;
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(from.x + ((to.x - from.x) * i) / steps);
    const y = Math.round(from.y + ((to.y - from.y) * i) / steps);
    let found = false;
    for (let dy = -2; dy <= 2 && !found; dy++) {
      for (let dx = -2; dx <= 2 && !found; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= edges.width || py >= edges.height) continue;
        if (edges.mask[py * edges.width + px]) found = true;
      }
    }
    if (found) hits++;
  }
  return hits / (steps + 1);
}

/**
 * Farbunterschied quer zur Kante: Für jede Seite werden Punkte knapp innerhalb
 * und knapp außerhalb verglichen. Am echten Buchrand wechselt die Farbe
 * durchgehend; ein Muster im Untergrund oder ein Zierrahmen sieht innen wie
 * außen gleich aus.
 */
function edgeContrast(edges: EdgeMap, quad: Quad) {
  const center = {
    x: (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4,
    y: (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4,
  };
  const far = Math.max(6, Math.round(Math.min(edges.width, edges.height) * 0.04));
  const near = Math.max(2, Math.round(far * 0.25));
  const pixel = (x: number, y: number) => {
    const px = Math.max(0, Math.min(edges.width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(edges.height - 1, Math.round(y)));
    const i = (py * edges.width + px) * 4;
    return [edges.rgb[i], edges.rgb[i + 1], edges.rgb[i + 2]];
  };
  /**
   * Mittelwert über ein ganzes Band statt an einem Punkt: Ein gestreifter
   * Untergrund würde sonst je nach Abstand mal helle, mal dunkle Streifen
   * treffen und Kontrast vortäuschen.
   */
  const band = (x: number, y: number, nx: number, ny: number) => {
    const sum = [0, 0, 0];
    let taken = 0;
    for (let d = near; d <= far; d++) {
      const [r, g, b] = pixel(x + nx * d, y + ny * d);
      sum[0] += r;
      sum[1] += g;
      sum[2] += b;
      taken++;
    }
    return sum.map((value) => value / Math.max(1, taken));
  };

  // Schwächste Seite zählt: Am echten Buchrand wechselt die Farbe auf *allen*
  // vier Seiten. Ein Rechteck aus Musterlinien hat immer mindestens eine Seite
  // mit demselben Untergrund innen wie außen.
  let weakest = Number.POSITIVE_INFINITY;
  for (let side = 0; side < 4; side++) {
    const from = quad[side];
    const to = quad[(side + 1) % 4];
    const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    // Normale, die vom Mittelpunkt weg zeigt
    let nx = -(to.y - from.y) / length;
    let ny = (to.x - from.x) / length;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    if ((mid.x + nx - center.x) ** 2 + (mid.y + ny - center.y) ** 2 < (mid.x - center.x) ** 2 + (mid.y - center.y) ** 2) {
      nx = -nx;
      ny = -ny;
    }

    let sideTotal = 0;
    let taken = 0;
    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;
      const outside = band(x, y, nx, ny);
      const inside = band(x, y, -nx, -ny);
      sideTotal +=
        (Math.abs(outside[0] - inside[0]) + Math.abs(outside[1] - inside[1]) + Math.abs(outside[2] - inside[2])) / 3;
      taken++;
    }
    weakest = Math.min(weakest, taken ? sideTotal / taken : 0);
  }
  return Number.isFinite(weakest) ? weakest : 0;
}

/**
 * Sucht das Buch als Viereck aus vier langen Kanten: zwei eher waagerechte und
 * zwei eher senkrechte Geraden, bewertet nach Kantenabdeckung und Größe.
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

  const edges = edgeMap(canvas);
  if (!edges) return fallback();
  const { width: ew, height: eh } = edges;

  // θ=90° beschreibt waagerechte, θ=0/180° senkrechte Geraden; ±22° Spielraum
  // für schief gehaltene Bücher.
  const horizontalAngles = Array.from({ length: 23 }, (_, i) => 68 + i * 2);
  const verticalAngles = [
    ...Array.from({ length: 12 }, (_, i) => i * 2),
    ...Array.from({ length: 11 }, (_, i) => 158 + i * 2),
  ];
  const horizontals = houghLines(edges, horizontalAngles, 14);
  const verticals = houghLines(edges, verticalAngles, 14);
  if (horizontals.length < 2 || verticals.length < 2) return fallback();

  const lineY = (line: Line) => {
    const point = intersect(line, { theta: 0, rho: ew / 2, votes: 0 });
    return point ? point.y : Number.NaN;
  };
  const lineX = (line: Line) => {
    const point = intersect(line, { theta: 90, rho: eh / 2, votes: 0 });
    return point ? point.x : Number.NaN;
  };

  let best: { quad: Quad; score: number } | null = null;

  for (let i = 0; i < horizontals.length; i++) {
    for (let j = i + 1; j < horizontals.length; j++) {
      const [topLine, bottomLine] =
        lineY(horizontals[i]) < lineY(horizontals[j])
          ? [horizontals[i], horizontals[j]]
          : [horizontals[j], horizontals[i]];
      const height = lineY(bottomLine) - lineY(topLine);
      if (!(height > eh * 0.3)) continue;
      // Ober- und Unterkante eines Buches sind nahezu parallel; zufällige
      // Linienpaare im Coverbild sind es fast nie.
      if (angleGap(topLine.theta, bottomLine.theta) > 10) continue;

      for (let k = 0; k < verticals.length; k++) {
        for (let l = k + 1; l < verticals.length; l++) {
          const [leftLine, rightLine] =
            lineX(verticals[k]) < lineX(verticals[l])
              ? [verticals[k], verticals[l]]
              : [verticals[l], verticals[k]];
          const width = lineX(rightLine) - lineX(leftLine);
          if (!(width > ew * 0.25)) continue;
          if (angleGap(leftLine.theta, rightLine.theta) > 10) continue;

          const tl = intersect(topLine, leftLine);
          const tr = intersect(topLine, rightLine);
          const br = intersect(bottomLine, rightLine);
          const bl = intersect(bottomLine, leftLine);
          if (!tl || !tr || !br || !bl) continue;

          const corners: Quad = [tl, tr, br, bl];
          const margin = Math.max(ew, eh) * 0.08;
          if (corners.some((p) => p.x < -margin || p.y < -margin || p.x > ew + margin || p.y > eh + margin)) continue;

          // Bücher sind hochformatig; extreme Seitenverhältnisse aussortieren.
          const ratio = width / height;
          if (ratio < 0.35 || ratio > 1.25) continue;

          const area = (width * height) / (ew * eh);
          // Ein Viereck, das fast das ganze Foto ausfüllt, ist fast immer der
          // Bildrand; ein winziges ist meist ein Detail auf dem Cover.
          if (area > 0.92 || area < 0.12) continue;

          const support =
            (segmentSupport(edges, tl, tr) +
              segmentSupport(edges, tr, br) +
              segmentSupport(edges, br, bl) +
              segmentSupport(edges, bl, tl)) /
            4;
          if (support < 0.45) continue;

          /**
           * Zwei Klassen: Vierecke mit klar belegten Kanten – darunter gewinnt
           * das größte. Zierrahmen und Titelkästen liegen immer *innerhalb* des
           * Buches, der echte Buchrand ist also der äußerste gute Kandidat.
           * Nur wenn gar nichts überzeugend belegt ist, entscheidet die
           * gewichtete Bewertung.
           */
          const contrast = edgeContrast(edges, corners);
          const solid = support >= 0.6 && contrast >= 10;
          const score = solid ? 10 + area : support + area + contrast / 60;
          if (!best || score > best.score) best = { quad: corners, score };
        }
      }
    }
  }

  if (!best) return fallback();

  // Zurück in die Koordinaten des Originalbildes.
  const sx = w / ew;
  const sy = h / eh;
  return best.quad.map((point) => ({
    x: Math.max(0, Math.min(w, point.x * sx)),
    y: Math.max(0, Math.min(h, point.y * sy)),
  })) as Quad;
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
