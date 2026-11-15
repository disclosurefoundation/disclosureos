---
"@disclosureos/records": patch
"@disclosureos/observables": patch
"@disclosureos/origins": patch
"@disclosureos/instruments": patch
"@disclosureos/scoring": patch
"@disclosureos/schema": patch
"@disclosureos/cli": patch
---

Use patched Zod 4.6.6 for validation, resolving GHSA-mrhx-c7xc-m3w5 without requiring a consumer dependency override. Preserve published schema identities and verify existing documents and package consumers against the patched runtime.
