import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket } from "./build.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
export async function verify(directory = path.join(here, "generated")) {
  const records =
    await import("../../packages/disclosureos-schema/node_modules/@disclosureos/records/dist/experimental/v2/index.js");
  const instruments =
    await import("../../packages/disclosureos-schema/node_modules/@disclosureos/instruments/dist/experimental/v2/index.js");
  const schema =
    await import("../../packages/disclosureos-schema/dist/experimental/v2/index.js");
  const reports = [];
  for (const scenario of ["airborne", "shipborne"]) {
    const p = await createPacket(scenario);
    for (const [name, bytes] of p.files)
      assert.deepEqual(
        await readFile(path.join(directory, scenario, name)),
        bytes,
        `${scenario}/${name}`,
      );
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
        `${scenario} ${name}: ${JSON.stringify(result.issues)}`,
      );
    let rows = 0,
      cells = 0;
    for (const layout of p.selection.layouts) {
      const bytes = p.assets.get(layout.productRef);
      if (layout.kind === "csv_table")
        for (let row = 0; row < layout.rowCount; row++) {
          const selected = schema.readProductSourceSelection(
            layout,
            { kind: "table_row", row },
            bytes,
          );
          assert.equal(
            Object.keys(selected.cells).length,
            layout.columns.length,
          );
          rows++;
        }
      else
        for (let scan = 0; scan < p.index.config.scans; scan++)
          for (let az = 0; az < p.index.config.azimuthBins; az++)
            for (let range = 0; range < p.index.config.rangeBins; range++) {
              const selected = schema.readProductSourceSelection(
                layout,
                { kind: "array_element", indices: [scan, az, range] },
                bytes,
              );
              assert.ok(Number.isFinite(selected.value) && selected.value >= 0);
              cells++;
            }
    }
    reports.push({
      scenario,
      success: true,
      files: p.files.size,
      rows,
      cells,
      detections: p.model.detections.length,
      trackStates: p.model.tracks.length,
      contracts: Object.keys(checks),
      scientific: "not_checked",
      physicalCalibration: "not_performed",
    });
  }
  return reports;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  console.log(JSON.stringify(await verify(process.argv[2]), null, 2));
