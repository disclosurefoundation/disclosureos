import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket } from "./build.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export async function verify(directory = path.join(here, "generated")) {
  const p = await createPacket();
  for (const [name, bytes] of p.files)
    assert.deepEqual(
      await readFile(path.join(directory, name)),
      bytes,
      `Generated file differs: ${name}`,
    );
  const records =
    await import("../../packages/disclosureos-schema/node_modules/@disclosureos/records/dist/experimental/v2/index.js");
  const instruments =
    await import("../../packages/disclosureos-schema/node_modules/@disclosureos/instruments/dist/experimental/v2/index.js");
  const schema =
    await import("../../packages/disclosureos-schema/dist/experimental/v2/index.js");
  const checks = {
    observation: records.parseExperimentalObservation(p.observation),
    acquisition: instruments.parseAcquisitionContext(p.context),
    selection: await schema.evaluateProductSourceSelection(
      p.observation,
      p.selection,
      { assets: p.assets },
    ),
    radar: await schema.evaluateRadarProfile(
      p.observation,
      p.context,
      p.selection,
      p.profile,
      { assets: p.assets },
    ),
  };
  for (const [name, result] of Object.entries(checks))
    assert.equal(
      result.success,
      true,
      `${name}: ${JSON.stringify(result.issues)}`,
    );
  // Decode every plotted CSV row and every received/threshold cell with the canonical reader.
  let rows = 0,
    cells = 0;
  for (const layout of p.selection.layouts) {
    const bytes = p.assets.get(layout.productRef);
    if (layout.kind === "csv_table")
      for (let row = 0; row < layout.rowCount; row++) {
        const read = schema.readProductSourceSelection(
          layout,
          { kind: "table_row", row },
          bytes,
        );
        assert.ok(
          read.cells &&
            Object.keys(read.cells).length === layout.columns.length,
        );
        rows++;
      }
    else
      for (let scan = 0; scan < 16; scan++)
        for (let az = 0; az < 72; az++)
          for (let range = 0; range < 64; range++) {
            const read = schema.readProductSourceSelection(
              layout,
              { kind: "array_element", indices: [scan, az, range] },
              bytes,
            );
            assert.ok(Number.isFinite(read.value) && read.value >= 0);
            cells++;
          }
  }
  return {
    success: true,
    files: p.files.size,
    rows,
    cells,
    detections: p.model.detections.length,
    trackStates: p.model.tracks.length,
    contracts: Object.keys(checks),
    scientific: "not_checked",
    physicalCalibration: "not_performed",
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await verify(process.argv[2]), null, 2));
