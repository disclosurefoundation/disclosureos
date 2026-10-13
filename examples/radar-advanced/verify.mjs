import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createPacket } from "./build.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
export async function verify(directory = path.join(here, "generated")) {
  const records = await import(
    "../../packages/disclosureos-schema/node_modules/@disclosureos/records/dist/experimental/v2/index.js"
  );
  const instruments = await import(
    "../../packages/disclosureos-schema/node_modules/@disclosureos/instruments/dist/experimental/v2/index.js"
  );
  const schema = await import(
    "../../packages/disclosureos-schema/dist/experimental/v2/index.js"
  );
  const reports = [];
  for (const scenario of ["military", "secondary"]) {
    const packet = await createPacket(scenario);
    for (const [name, bytes] of packet.files)
      assert.deepEqual(
        await readFile(path.join(directory, scenario, name)),
        bytes,
        `${scenario}/${name}`
      );
    const checks = {
      observation: records.parseExperimentalObservation(packet.observation),
      acquisition: instruments.parseAcquisitionContext(packet.context),
      selection: await schema.evaluateProductSourceSelection(
        packet.observation,
        packet.selection,
        { assets: packet.assets }
      ),
      radar: await schema[
        scenario === "military"
          ? "evaluateSteeredRadarProfile"
          : "evaluateSecondaryRadarProfile"
      ](packet.observation, packet.context, packet.selection, packet.profile, {
        assets: packet.assets,
      }),
    };
    for (const [name, result] of Object.entries(checks))
      assert.equal(
        result.success,
        true,
        `${scenario} ${name}: ${JSON.stringify(result.issues)}`
      );
    let rows = 0,
      cells = 0;
    for (const layout of packet.selection.layouts) {
      const bytes = packet.assets.get(layout.productRef);
      if (layout.kind === "csv_table")
        for (let row = 0; row < layout.rowCount; row++) {
          const selected = schema.readProductSourceSelection(
            layout,
            { kind: "table_row", row },
            bytes
          );
          assert.equal(
            Object.keys(selected.cells).length,
            layout.columns.length
          );
          rows++;
        }
      else
        for (let dwell = 0; dwell < packet.model.schedule.length; dwell++)
          for (let range = 0; range < packet.index.config.rangeBins; range++) {
            const selected = schema.readProductSourceSelection(
              layout,
              { kind: "array_element", indices: [dwell, range] },
              bytes
            );
            assert.ok(Number.isFinite(selected.value) && selected.value >= 0);
            cells++;
          }
    }
    reports.push({
      scenario,
      success: true,
      files: packet.files.size,
      rows,
      cells,
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
