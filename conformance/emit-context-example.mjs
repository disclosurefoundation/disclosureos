import { writeFileSync } from "node:fs";
import { fixture, bytes } from "../examples/v2/context-demo/fixture.mjs";
const f = fixture();
for (const name of ["history", "context", "observation", "acquisition"])
  writeFileSync(
    new URL(`../examples/v2/context-demo/${name}.json`, import.meta.url),
    bytes(f[name]),
  );
for (const [name, data] of f.artifacts)
  writeFileSync(
    new URL(`../examples/v2/context-demo/${name}`, import.meta.url),
    data,
  );
