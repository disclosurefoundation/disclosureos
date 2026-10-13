export const config = {
  rows: 33,
  columns: 41,
  sensorOrigin: [0, 0, 18],
  bounds: { min: [-18, 0, -1], max: [18, 30, 20] },
  aimBounds: { minX: -18, maxX: 18, minY: 2, maxY: 30 },
  nearRangeM: 0.1,
  farRangeM: 60,
  rayToleranceM: 0.00001,
  classes: [
    { code: 0, label: "Unassigned" },
    { code: 2, label: "Terrain" },
    { code: 5, label: "Vegetation" },
    { code: 6, label: "Structure" },
  ],
};
const round = (v) => Number(v.toFixed(6));
const ground = (x, y) => 0.5 + 0.025 * x + 0.02 * y;
export function simulate() {
  const pulses = [],
    points = [];
  for (let row = 0; row < config.rows; row++)
    for (let col = 0; col < config.columns; col++) {
      const pulseIndex = pulses.length,
        id = `pulse-${String(pulseIndex).padStart(4, "0")}`;
      const x = -18 + (36 * col) / (config.columns - 1),
        y = 2 + (28 * row) / (config.rows - 1),
        aim = [round(x), round(y), round(ground(x, y))];
      // The reference point fixes a beam direction. No-return rows do not measure this position.
      const unavailable = row >= 23 && row <= 27 && col >= 29 && col <= 35;
      const noReturn = row >= 3 && row <= 8 && col >= 3 && col <= 8;
      const pulse = {
        id,
        scanRow: row,
        scanColumn: col,
        aim,
        status: unavailable
          ? "unavailable"
          : noReturn
          ? "no_return"
          : "retained",
        returnCount: unavailable ? null : 0,
      };
      pulses.push(pulse);
      if (unavailable || noReturn) continue;
      const atHeight = (z) => {
        const t = (18 - z) / (18 - aim[2]);
        return [round(aim[0] * t), round(aim[1] * t), round(z)];
      };
      const roof = atHeight(4.8);
      const hits = [];
      if (roof[0] >= 2 && roof[0] <= 9 && roof[1] >= 6 && roof[1] <= 12) {
        hits.push({
          position: roof,
          intensity: 0.72 + 0.06 * Math.sin(col * 0.5),
          classCode: 6,
        });
      } else {
        const canopy = atHeight(6.2),
          inside =
            ((canopy[0] + 7) / 4.4) ** 2 + ((canopy[1] - 12) / 4.2) ** 2 < 1;
        if (inside) {
          hits.push({
            position: canopy,
            intensity: 0.38 + 0.05 * Math.cos(row),
            classCode: 5,
          });
          if ((row + col) % 3 !== 0)
            hits.push({
              position: atHeight(3.8),
              intensity: 0.29 + 0.04 * Math.sin(col),
              classCode: 5,
            });
        }
        hits.push({
          position: aim,
          intensity: 0.48 + 0.08 * Math.sin(x * 0.31) * Math.cos(y * 0.23),
          classCode: row === 15 && col < 4 ? 0 : 2,
        });
      }
      pulse.returnCount = hits.length;
      for (const [i, hit] of hits.entries())
        points.push({
          pulseId: id,
          returnNumber: i + 1,
          returnCount: hits.length,
          x: hit.position[0],
          y: hit.position[1],
          z: hit.position[2],
          intensity: round(hit.intensity),
          classCode: hit.classCode,
        });
    }
  return { pulses, points };
}
