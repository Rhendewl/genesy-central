export type CanvasPoint = { x: number; y: number };
export type CanvasSize = { width: number; height: number };
export type AlignmentGuide = { axis: "x" | "y"; value: number };

export type SnapResult = {
  position: CanvasPoint;
  guides: AlignmentGuide[];
};

type AlignmentTarget = { value: number; guide: number; priority: number };

function nearestSnap(values: number[], targets: AlignmentTarget[], threshold: number) {
  let match: { delta: number; guide: number; distance: number; priority: number } | null = null;
  for (const value of values) {
    for (const target of targets) {
      const delta = target.value - value;
      const distance = Math.abs(delta);
      if (distance > threshold) continue;
      if (!match || distance < match.distance || (distance === match.distance && target.priority < match.priority)) {
        match = { delta, guide: target.guide, distance, priority: target.priority };
      }
    }
  }
  return match;
}

/** Snaps a moving rectangle to canvas centres and to the edges/centres of its siblings. */
export function snapCanvasPosition(
  position: CanvasPoint,
  size: CanvasSize,
  canvas: CanvasSize,
  siblings: Array<CanvasPoint & CanvasSize>,
  threshold = 10,
): SnapResult {
  const xValues = [position.x, position.x + size.width / 2, position.x + size.width];
  const yValues = [position.y, position.y + size.height / 2, position.y + size.height];
  const xTargets: AlignmentTarget[] = [{ value: canvas.width / 2, guide: canvas.width / 2, priority: 0 }];
  const yTargets: AlignmentTarget[] = [{ value: canvas.height / 2, guide: canvas.height / 2, priority: 0 }];

  siblings.forEach((item) => {
    [item.x, item.x + item.width / 2, item.x + item.width].forEach((value) => xTargets.push({ value, guide: value, priority: 1 }));
    [item.y, item.y + item.height / 2, item.y + item.height].forEach((value) => yTargets.push({ value, guide: value, priority: 1 }));
  });

  const xMatch = nearestSnap(xValues, xTargets, threshold);
  const yMatch = nearestSnap(yValues, yTargets, threshold);
  const x = Math.min(Math.max(0, position.x + (xMatch?.delta ?? 0)), Math.max(0, canvas.width - size.width));
  const y = Math.min(Math.max(0, position.y + (yMatch?.delta ?? 0)), Math.max(0, canvas.height - size.height));

  return {
    position: { x, y },
    guides: [
      ...(xMatch ? [{ axis: "x" as const, value: xMatch.guide }] : []),
      ...(yMatch ? [{ axis: "y" as const, value: yMatch.guide }] : []),
    ],
  };
}
