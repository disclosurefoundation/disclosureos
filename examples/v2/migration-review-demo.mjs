import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
export function migrationReviewExample() {
  const legacy = {
    id: "synthetic-review",
    temporal: { date: "1900-01-01", dateCertainty: "exact" },
    location: {
      id: "synthetic",
      name: "Synthetic zero coordinate",
      country: "XX",
      latitude: 0,
      longitude: 0,
      siteType: "unknown",
    },
    status: "draft",
    createdAt: "2026-09-08T00:00:00Z",
    updatedAt: "2026-09-08T00:00:00Z",
    extensions: {
      "legacy.scores": { version: "synthetic-v1", score: 0, confidence: null },
    },
  };
  const sourceBytes = Buffer.from(JSON.stringify(legacy, null, 2) + "\n");
  const plan = {
    kind: "legacy_migration_review",
    schemaVersion: "0.1.0",
    namespace: "synthetic-review-demo",
    source: {
      sha256: createHash("sha256").update(sourceBytes).digest("hex"),
      byteLength: sourceBytes.length,
    },
    reviewedBy: "Synthetic reviewer",
    reviewedAt: "2026-09-08T00:00:00Z",
    decisions: [
      {
        sourceId: legacy.id,
        field: "eventTime",
        sourcePointers: ["/temporal/date", "/temporal/dateCertainty"],
        rationale:
          "Synthetic fixture: retain this date literally at calendar-day precision; no instant is implied.",
        value: {
          state: "known",
          value: { kind: "date", value: "1900-01-01" },
          sourceRefs: ["source:legacy-input"],
        },
      },
      {
        sourceId: legacy.id,
        field: "position",
        sourcePointers: ["/location/latitude", "/location/longitude"],
        rationale:
          "Synthetic fixture: coordinates are deliberately zero and the fixture author declares WGS84. This is not a rule for real legacy records.",
        value: {
          state: "known",
          value: {
            kind: "geodetic",
            frameRef: "frame:review-frame",
            latitude: 0,
            longitude: 0,
          },
          sourceRefs: ["source:legacy-input"],
        },
        frames: [
          {
            id: "review-frame",
            kind: "geodetic",
            definition: {
              state: "identified",
              authority: "EPSG",
              code: "4326",
            },
            angularUnit: "deg",
          },
        ],
      },
    ],
  };
  return { legacy, sourceBytes, plan };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  if (!process.argv[2])
    throw new Error("Provide a new directory for the synthetic fixture");
  const folder = resolve(process.argv[2]);
  mkdirSync(folder, { mode: 0o700 });
  const fixture = migrationReviewExample();
  writeFileSync(join(folder, "legacy.json"), fixture.sourceBytes, {
    mode: 0o600,
    flag: "wx",
  });
  writeFileSync(
    join(folder, "review.json"),
    JSON.stringify(fixture.plan, null, 2) + "\n",
    { mode: 0o600, flag: "wx" }
  );
  console.log(folder);
}
