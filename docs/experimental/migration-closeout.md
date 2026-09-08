# WP09 closeout: supported local migration and compatibility

WP09 is implementation-complete for the bounded experimental local migration scope
agreed during closeout. This acceptance record covers supported v1 record migration,
explicit review and revision selection, private application, verified local reading,
and rollback with retained history. It does not certify arbitrary legacy formats,
a production database migration, a partner dataset, scientific validity or stable v2.

The three closeout increments are complete in this change:

1. [Field dispositions and sensor revision review](migration-compatibility.md).
2. [Developer compatibility guide](migration-guide.md).
3. Reusable end-to-end acceptance verification and this scope/limitations record.

## Reproduce the acceptance run

Use Node 22 and the repository's pinned pnpm version. From the intended checkout:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
pnpm verify:wp09-closeout
```

To exercise an explicitly installed CLI with the same fixtures and assertions:

```sh
node conformance/migration-closeout.mjs --cli /absolute/path/to/node_modules/@disclosureos/cli/dist/index.js
```

The runner creates a private temporary directory, uses synthetic inputs only, invokes
the actual CLI in subprocesses, verifies each expected exit/result, and removes its own
temporary data afterward. It deliberately interrupts one application process and later
corrupts a synthetic candidate to test recovery. It does not operate on user-supplied
stores, contact partners, fetch data or touch the Index. The optional CLI path selects
trusted executable code; it is not an untrusted data argument.

Successful output is a `wp09_synthetic_software_acceptance` summary with `status: passed`,
scenario names, reconciled fixture counts and explicit unchecked boundaries. An assertion
or subprocess failure exits nonzero instead. This is a software acceptance report, not
a signed reproducibility receipt or scientific evaluation.

## Acceptance evidence

The combined runner is [migration-closeout.mjs](../../conformance/migration-closeout.mjs).
Its [test wrapper](../../conformance/migration-closeout.test.mjs) runs in package CI.
The focused suites below retain their additional failure/concurrency coverage.

| Requirement | Demonstration | Evidence |
| --- | --- | --- |
| No silently omitted records | Two valid source rows become four rows across two distinct reviewed batches; repeating an exact batch does not add rows. Two candidates are selected and two historical revision rows remain. A separate three-row batch retains one reviewed row, one pending row and one quarantined row. | Combined runner; dry-run/export/ledger suites |
| Every field has a disposition | Inventory field count equals mapped + retained-without-conversion + unresolved. Quarantined and traversal-incomplete records are explicit. | Combined runner; `migration-compatibility.test.mjs` |
| Real zero coordinates and old dates survive | Explicit known review preserves `0,0` and `1900-01-01`. Another record explicitly remains unknown while retaining its original legacy values. | Combined runner; `migration-review.test.mjs` |
| No implicit sensor revision or calibration inference | Bare references stay unresolved. Separate focused checks accept exact reviewed pins, reject conflicts and do not select a newer manifest automatically. | Combined inventory; `migration-compatibility.test.mjs` |
| Explicit conflict resolution | Two revisions per identity survive staging. Empty choices cannot apply; selected revisions must be exact ledger members. | Combined runner; `migration-resolution.test.mjs` |
| Resumable, repeatable application | Actual process interruption leaves no completion receipt. Retry resumes; another identical application reuses the store. Verification succeeds after original source/review/bundle/ledger paths are removed. | Combined runner; `migration-apply.test.mjs` |
| Verified reads and non-destructive rollback | Selected JSON equals the exact chosen ledger candidate. Stale heads fail. Legacy rollback and restoration leave every store file unchanged. | Combined runner; `migration-read-path.test.mjs` |
| Corrupt stores fail closed | A changed candidate blocks reads. The verified head still permits legacy rollback; all other store files stay unchanged and corrupted data is neither repaired nor deleted. | Combined runner; read-path/application suites |
| Legacy evaluations remain separate | Embedded legacy inputs are preserved. Standalone historical score outputs retain exclusion flags rather than becoming v2 evaluations. | Combined runner; `migration-legacy-scores.test.mjs` |
| Developers can identify compatibility boundaries | Version/parser selection, breaking data semantics, field support, command-specific exits, profiles and recovery are documented together. | [Developer guide](migration-guide.md) |

Local closeout validation also includes the full conformance/partner suite, workspace
build/type checks, package unit tests, legacy compatibility matrix, all seven packages'
publication checks, and this same combined runner against a fresh seven-package install.
GitHub's check status remains the merge gate; a local result does not assert remote CI
completion. The migration CLI and document contracts were not changed in this checkpoint.

## What is deliberately not claimed

- **All fields converted:** unsupported fields remain explicitly retained or unresolved.
  A successful application stores reviewed drafts; it does not imply research readiness.
- **All historical formats supported:** the record adapter accepts v1 enriched records,
  and the standalone score adapter covers its documented result contracts. New formats
  require actual examples and explicit adapters.
- **Sensor measurements converted:** reviewed revision associations are supplementary
  reports with checked byte pins and reviewer-declared support. They do not automatically
  enter candidate/store receipts or construct measurement/acquisition bindings.
- **Production rollback:** the tested selector is a local consumer interface. Legacy mode
  instructs a future consumer to use its existing reader; no Index database was switched.
- **Published data is safe:** reports and archives may contain private notes and assets.
  A separate public projection and data permission decision remain required.
- **Authenticated or independently reproduced science:** unsigned hashes and current-code
  replay preserve their existing limits. Python integrity checks alone are not an
  independent semantic implementation or scientific reproduction.
- **Stable release or large-archive readiness:** this uses bounded synthetic records. It
  does not benchmark bulk telemetry, establish scientific thresholds, publish packages,
  or substitute for the forthcoming ELDÆON native dataset.

These are scope boundaries and consumer/research gates, not additional open-ended WP09
infrastructure checkpoints. A failing supported-workflow regression would reopen WP09;
a new source format should be justified by a concrete integration need.

## Handoff to WP10

The next milestone is a bounded, inspectable consumer experience: source input, normalized
record, instrument/source context, measurements versus assertions, unresolved gaps and
record download. Use the existing contracts and diagnostics. The UI must preserve the
separate meanings of migration success, input integrity and profile outcome.

Begin with clearly labeled fixtures or the available source sample while native ELDÆON
access is pending. Once access is available, inventory the archive and select a representative
acquisition/control slice with its supporting context before broader ingestion. Keep native
files externally referenced. Independent partner/scientific review remains WP11, and
coordinated release/governance remains WP12.
