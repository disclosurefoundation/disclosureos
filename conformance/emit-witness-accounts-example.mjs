import { writeFileSync } from "node:fs";
import {
  fixture,
  bundle,
  bytes,
} from "../examples/v2/witness-accounts-demo/fixture.mjs";
const f = fixture();
bundle(f);
for (const [name, value] of Object.entries(f))
  writeFileSync(
    new URL(
      `../examples/v2/witness-accounts-demo/${name}.json`,
      import.meta.url
    ),
    bytes(value)
  );
