# @disclosureos/origins — Deferred Items

Items noted during code review that are intentionally deferred for future consideration.
These are low-priority and do not affect correctness or usability of the current API.

---

## 1. Missing `formatClassificationSummary` Formatter

**Source:** API Surface review  
**Priority:** P3 (Low)  
**Description:** The `formatters` module does not include a `formatOriginSummary(claim: OriginClaim): string` utility that would produce a human-readable one-liner like "Physical > ETH (0.75 confidence)". This mirrors the pattern in `@disclosureos/observables` where `formatObservable` resolves IDs to readable strings.  
**Recommendation:** Add when downstream consumers (e.g., UI layers) need formatted classification summaries. Keep it optional to avoid bloating the foundational package.

---

## 2. Missing `createHypothesisWeight` Factory

**Source:** API Surface review  
**Priority:** P3 (Low)  
**Description:** There is no dedicated factory for constructing `HypothesisWeight` objects with validation. Currently, consumers build them inline, which means they bypass the `getNode` and confidence validation that `createOriginClaim` enforces.  
**Recommendation:** Consider adding a `createHypothesisWeight(nodeId, confidence, label?)` factory if usage patterns reveal frequent inline construction errors. The validation logic already exists in the shared `validateHypothesisWeight` helper, so exposing it as a public factory is low-effort.

---

## 3. tsconfig/tsup Minor Drift from Sibling Packages

**Source:** Cross-package consistency review  
**Priority:** P3 (Low)  
**Description:** Minor differences exist between this package's `tsup.config.ts` and sibling packages (e.g., `@disclosureos/records`, `@disclosureos/observables`). Specifically: entry point naming conventions and the presence/absence of `clean: true`. These do not cause build failures but slightly reduce uniformity.  
**Recommendation:** Harmonize in a future pass when all three packages are stable and a shared `tsup` preset or workspace-level config is introduced.

---

## 4. Schema Version Discriminator

**Source:** Cross-package consistency review  
**Priority:** P3 (Low)  
**Description:** Neither `OriginClaim` nor `OCSNode` includes a `schemaVersion` discriminator field. While not needed for the current v1 release (since there is no prior version to migrate from), adding a version field would simplify future migrations if the taxonomy structure or classification shape evolves.  
**Recommendation:** Consider adding `schemaVersion: 1` to `OriginClaim` in a future major version, aligned with how `@disclosureos/records` handles its `Observation` type evolution. Not urgent for initial release since the packages have not yet been published.
