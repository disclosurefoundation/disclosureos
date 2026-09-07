# V2 conformance foundation

These synthetic fixtures reproduce known v1 behavior while specifying initial v2 acceptance targets. Zero coordinates are deliberate fixture values, not migration defaults or partner data.

Run after building the packages:

```
pnpm conformance:baseline
pnpm conformance:target
```

The baseline command detects changes to the reviewed behavior. It does **not** certify conformance. The target command currently fails and must remain visibly failing until the corresponding implementation work is complete. Never change target expectations merely to obtain a green build.

This first corpus covers the TypeScript observation parser only. Cross-validator agreement (JSON Schema, CLI, browser, Python), manifest constraints, scoring properties, reference resolution, migration, and dataset profiles remain to be added. A release requires those surfaces, not just this initial corpus.

## Proposed conformance contract

Validation has three independently reported stages: structural shape and values; semantic integrity such as reference resolution and dates; profile eligibility for a particular analysis. A structurally valid record can still be ineligible for scoring or independent analysis. Diagnostics should expose a stable code, JSON pointer, severity, and stage.

Missing, withheld, not collected, and not applicable must remain distinguishable. Migrations must preserve the original record and never invent coordinates, dates, attribution, or calibration. Confirmed observable claims require traceable sensor support and attribution; reported testimony remains representable without becoming confirmed by default.

Measurement timestamps and intervals remain authoritative over convenience labels. Preserve source bytes, hashes, time convention, transforms, and derived artifact lineage. Correlation with a known aircraft is contextual information, not confirmation of an anomalous observable.

Existing published schema identifiers are immutable. Package v2 must use new artifact identifiers where existing schema revisions are already at 2.0.0. The exact v2 schemas and diagnostic vocabulary are still design work, not frozen by this document.
