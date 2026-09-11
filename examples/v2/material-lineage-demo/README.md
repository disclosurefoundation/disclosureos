# Fictional physical material lineage control

Build the canonical records package from this checkout with Node.js 22:

```sh
pnpm --filter @disclosureos/records build
node examples/v2/material-lineage-demo/run.mjs
```

The APIs are unreleased and are not available in npm beta.3. Do not publish or bump
package versions for this checkpoint; the next publication is consolidated after
V2 implementation closeout.

An uncollected surface impression is represented separately from a soil specimen.
The specimen has two derived aliquots, each with its own identity. The parent has
a declared physical handoff with an earlier gap. Aliquot A has its own unknown
custody predecessor; aliquot B has no supplied custody actions. Neither inherits
the parent's custody or collection details. A report of spectroscopy remains
source wording, with no analytical result or laboratory report invented.

Every person, object and declaration is fictional. The parser checks structure and
local consistency only. Snapshot/source integrity, physical identity, profile
applicability, complete custody and scientific conclusions are not established.
The observation snapshot is supplied for future external-review integration; this
runner does not validate that snapshot or fetch the referenced handling log.
