import type { Status } from "../filter";

// One cross image per status, registered with the map as `cross-<status>`.
export const MARKER_COLORS = { open: "#16a34a", closing: "#f59e0b", later: "#2563eb", closed: "#9ca3af" } as const satisfies Record<Status, string>;
export const MARKER_ORDER = { closed: -1, later: 0, closing: 1, open: 2 } as const satisfies Record<Status, number>; // open pharmacies drawn on top

/** A pharmacy cross with a white outline, drawn at 2x for sharp rendering. */
export function crossImage(color: string): ImageData {
  const size = 52;
  const pad = 5; // room for the outline
  const arm = 16; // arm thickness
  const a = (size - arm) / 2;
  const b = a + arm;
  const e = size - pad;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const points = [[a, pad], [b, pad], [b, a], [e, a], [e, b], [b, b], [b, e], [a, e], [a, b], [pad, b], [pad, a], [a, a]];
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}
