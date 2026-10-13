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
  for (const scenario of ["ground", "civilian"]) {
    const p = await createPacket(scenario);
    for (const [name, bytes] of p.files)
      assert.deepEqual(
        await readFile(path.join(directory, scenario, name)),
        bytes,
        `${scenario}/${name}`
      );
    const checks = {
      observation: records.parseExperimentalObservation(p.observation),
      acquisition: instruments.parseAcquisitionContext(p.context),
      selection: await schema.evaluateProductSourceSelection(
        p.observation,
        p.selection,
        { assets: p.assets }
      ),
      radar: await schema.evaluateRadarProfile(
        p.observation,
        p.context,
        p.selection,
        p.profile,
        { assets: p.assets }
      ),
    };
    for (const [name, result] of Object.entries(checks))
      assert.equal(
        result.success,
        true,
        `${scenario} ${name}: ${JSON.stringify(result.issues)}`
      );
    // Decode each complete table once. Re-reading an entire CSV for every row
    // makes a large truth table quadratic without increasing byte coverage.
    // The profile evaluator has also decoded and checked every radar-role cell.
    let rows = 0,
      cells = 0;
    const decoded = checks.radar.data.products;
    for (const layout of p.selection.layouts) {
      const bytes = p.assets.get(layout.productRef);
      if (layout.kind === "csv_table") {
        const [header, ...records] = schema.readSourceCsv(bytes);
        assert.deepEqual(header, layout.columns);
        assert.equal(records.length, layout.rowCount);
        for (const record of records) {
          assert.equal(record.length, layout.columns.length);
          rows++;
        }
        for (const row of new Set([
          0,
          Math.floor(layout.rowCount / 2),
          layout.rowCount - 1,
        ])) {
          if (row < 0 || row >= layout.rowCount) continue;
          const selected = schema.readProductSourceSelection(
            layout,
            { kind: "table_row", row },
            bytes
          );
          assert.deepEqual(
            selected.cells,
            Object.fromEntries(
              layout.columns.map((column, i) => [column, records[row][i]])
            )
          );
        }
      } else {
        const role = Object.entries(p.profile.products).find(
          ([, ref]) => ref === layout.productRef
        )?.[0];
        const values = decoded[role];
        const expected = p.model[layout.id];
        const count = layout.axes.reduce((n, a) => n * a.length, 1);
        assert.equal(values.length, count);
        assert.equal(expected.length, count);
        for (let i = 0; i < count; i++) {
          assert.ok(Number.isFinite(values[i]) && values[i] >= 0);
          assert.equal(values[i], expected[i]);
          cells++;
        }
        for (const i of new Set([0, Math.floor(count / 2), count - 1])) {
          let at = i;
          const indices = layout.axes.map(() => 0);
          for (let axis = indices.length - 1; axis >= 0; axis--) {
            indices[axis] = at % layout.axes[axis].length;
            at = Math.floor(at / layout.axes[axis].length);
          }
          const selected = schema.readProductSourceSelection(
            layout,
            { kind: "array_element", indices },
            bytes
          );
          assert.equal(selected.value, values[i]);
        }
      }
    }
    reports.push({
      scenario,
      success: true,
      files: p.files.size,
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
