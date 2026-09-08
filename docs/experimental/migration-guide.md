# Developer guide: v1 compatibility and experimental v2 adoption

This is the entry point for developers adopting the experimental contracts from a
built checkout. It documents the supported migration boundary, not a stable v2 release
or a live Index integration. The package repository is authoritative for these contracts;
the website and Index are separate consumers and do not adopt changes just because a
package PR was merged.

The practical objective is to preserve existing records while making their measurements,
assertions, evaluations and limitations distinguishable. A completed local migration
means a selected set of reviewed drafts and its history were materialized correctly.
It does not mean every field was converted, a research profile passed, or publication
was approved.

## 1. Choose the correct entry point

| Starting material | Start here | What this does not do |
| --- | --- | --- |
| Existing v1 enriched Observation JSON | `migrate dry-run`, then `migrate compatibility` | Does not accept arbitrary database exports as equivalent v1 records. |
| Standalone historical completeness/compellingness outputs | `migrate legacy-scores` with explicit declarations | Does not turn old scores into v2 evaluations or validate their arithmetic. |
| Native sensor files, telemetry or a large partner archive | [Source intake](source-intake.md), inventory and a documented format adapter | Does not load bulk telemetry into Observation JSON or infer acquisition metadata. |
| Already-authored experimental Observation or claim history | The matching records parser, followed by an applicable profile | Does not require passing through the legacy migrator. |

The [ELDÆON handoff](eldaeon-field-mapping.md) lists required native-file and acquisition
context. Public sample mapping and legacy record migration are different workflows.
A large archive can retain native formats; contracts describe files and relationships.

## 2. Keep versions and parsers separate

The existing package-root APIs describe the legacy record model. Experimental APIs
are opt-in `/experimental/v2` exports. The directory name is not a universal document
version: Observation and claim history currently declare `schemaVersion: 0.1.0`, while
other artifacts have their own versions. The historical scoring schema's `2.0.0` does
not denote the new experimental evaluation framework.

For an integration, record the exact checkout commit or installed package versions,
document schema IDs/versions, rule-set and evaluation policy identities, and relevant
input hashes. Retain that runtime for historical replay. There is no coordinated
stable-v2 release manifest supplied by this guide, and installing npm `latest` is not
a promise of the experimental capabilities described here. Never overwrite old schema
URLs with a different contract.

| Input | Public API |
| --- | --- |
| v1 enriched observation, including observable/origin slots | `parseEnrichedObservation` from `@disclosureos/schema` |
| Experimental factual Observation | `parseExperimentalObservation` from `@disclosureos/records/experimental/v2` |
| Experimental Observation plus claim history | `parseExperimentalClaimHistory` from the same experimental records export |
| Acquisition context | `parseAcquisitionContext` from `@disclosureos/instruments/experimental/v2` |

Do not use the legacy core `ObservationSchema.parse()` to clean enriched records: it
can strip extension slots. Do not send a v2 document through the legacy `validate`
command and interpret its result as v2 conformance. Use the parser for the actual
`kind` and schema identity, then the appropriate profile. JSON Schema structural
validation alone does not perform semantic reference or profile checks.

## 3. Breaking conceptual and data changes

| Legacy representation or assumption | Experimental contract / supported migration behavior |
| --- | --- |
| Bare temporal/location values | Explicit known, approximate, unknown or redacted envelopes; supplied precision, provenance and frames where required. No guessed datum or sentinel erasure. |
| One record with nested descriptive/evaluative slots | Factual Observation plus source assertions, measurements and separately attributed claims. Many legacy fields remain retained without automatic conversion. |
| Publication states `draft`, `review`, `published`, `archived`, `retracted` | Observation states `draft`, `published`, `withdrawn`; migration creates drafts and retains the original state rather than guessing equivalents. |
| Original record ID | Stable `legacy-...` hash from namespace and original ID. Keep the namespace consistent; original IDs remain in retained inputs. Duplicate IDs within one input are quarantined. |
| Free-form sensor readings and unversioned `sensorRef` | Explicit acquisition/instrument/manifest context and measured quantities. A reviewed manifest pin alone does not convert readings or establish calibration. |
| Embedded assessment or missing confidence | Retained historical material, not automatically a supported v2 claim; missing confidence is not certainty. |
| One aggregate compellingness score | Separate declaration summaries, documentary/research prerequisites and profile outcomes. No new default aggregate ranking. |
| Completeness percentage | Legacy field-population coverage, not analytical readiness. Required information depends on the applicable profile. |
| A parser accepting a record | Structural/semantic success only; inspect profile, external and unchecked-reference statuses separately. |
| Private notes or access labels inside JSON | No automatic public projection. Retained sources, extensions and reports can contain private data. |

Experimental parsers reject unexpected core keys while preserving namespaced extensions.
Units and frames remain declarations: parsing does not convert units, transform coordinates
or establish scientific adequacy. See the [Observation contract](observation-contract.md),
[claim history](claim-history.md) and [field disposition inventory](migration-compatibility.md).

## 4. Supported migration workflow

Use Node 22 and pnpm 9.15 from a clean checkout of the intended commit:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/cli...' build
node packages/disclosureos-cli/dist/index.js migrate --help
```

The commands below use `disclosureos` as shorthand for the built CLI above or an
explicitly installed matching artifact. Paths are placeholders, not supplied data.
Use new private output locations. JSON stdout can include every original input field;
if saving it, set private permissions and avoid overwriting existing reports.

| Step | Command | Interpretation |
| --- | --- | --- |
| Inventory | `migrate dry-run legacy.json --id collection --json` | Retains exact source bytes, drafts and quarantined rows. |
| Field boundary | `migrate compatibility legacy.json --id collection --json` | Separates mapped, retained-without-conversion and unresolved fields. |
| Explicit time/position review | `migrate review legacy.json review.json --json` | Applies declared mappings to drafts; invalid row mappings quarantine the whole row. |
| Private export | `migrate export legacy.json review.json --out bundle --json` | Exports reviewed candidates and retains all source-row accounting. |
| Export verification | `migrate verify bundle --json` | Recomputes the bundle from retained inputs. |
| Stage batches | `migrate ledger bundle --out ledger --json` | Retains revisions and deduplicates exact batches. Multiple bundle paths are supported. |
| Verify staging | `migrate ledger-verify ledger --json` | Checks the immutable snapshot and inventory. |
| Select revisions | `migrate resolve ledger decisions.json --json` | Checks explicit select/defer decisions against the pinned ledger. |
| Apply locally | `migrate apply ledger decisions.json --out store --json` | Materializes selected candidates and publishes a completion receipt. |
| Verify application | `migrate apply-verify store --json` | Verifies the completed store without requiring original external source paths. |

Author the [review plan](migration-review.md) from supplied information; the
[synthetic review example](../../examples/v2/migration-review-demo.mjs) demonstrates its
structure, not real-world defaults. Author [resolution decisions](migration-resolution.md)
using exact revision hashes from the ledger. Even an identity with one revision requires
an explicit choice. There is no first/latest/highest-score selection. Selection does not
resolve missing fields or supply scientific support.

Application requires at least one selected candidate, selections for every identity,
and no deferred/unresolved identities or pending/quarantined source rows. Those are
row-selection gates. Unresolved measurement fields can still exist within selected
drafts. The compatibility inventory can therefore report exit 1 while a correctly
selected application succeeds. Preserve both meanings rather than equating their exits.

### Supplementary reports

Optional `migrate compatibility legacy.json sensor-review.json --id collection --json`
checks declared sensor-to-acquisition associations and pinned artifacts. Optional
`migrate legacy-scores scores.json plan.json --json` preserves standalone historical
score outputs. These reports are separate from the review/export/ledger/store pipeline.
They are not automatically inserted into existing receipts or applied candidates.
Retain them explicitly and have any future consumer integration verify their inputs.

## 5. Read selection and rollback

```sh
disclosureos migrate read-init --out selector --json
disclosureos migrate read-path selector --json
disclosureos migrate read-activate selector store --id CURRENT_HEAD --json
disclosureos migrate read-rollback selector EARLIER_HEAD --id CURRENT_HEAD --json
```

Replace head placeholders with hashes returned by the selector. Initialization records
a legacy fallback. Reads return `target.kind` and verified candidate objects for an
active local store. In legacy mode, a consumer must invoke its existing legacy reader;
the CLI does not load that database. An empty candidate list alone is not the routing
instruction. No command here switches the production Index or website.

Every transition appends history. Stale expected heads fail; rollback restores an earlier
selection without deleting stores or revisions. A rollback to a store re-verifies that
store. A rollback to legacy remains possible if the active store is corrupt. If the
journal verified but store verification failed, JSON errors include the current head.

The immutable application receipt still says `readPath: not_activated`: it describes
application at creation time. The separate selector records later activation. Do not
rewrite a receipt to reflect selector state.

## 6. Failure, recovery and exit handling

| Commands | Exit 0 | Exit 1 | Exit 2 |
| --- | --- | --- | --- |
| `dry-run`, `review` | No quarantined rows | Report includes quarantined rows | Input/usage failure |
| `compatibility` | No unresolved fields/references or quarantined rows | Usable inventory with remaining issues | Invalid input/review |
| `export`, `verify` | Complete bundle operation without pending/quarantined rows | Bundle operation succeeds with pending/quarantined rows | Input, integrity, destination or write failure |
| `ledger`, `ledger-verify` | No conflicts, pending or quarantined rows | Snapshot operation succeeds with unresolved rows | Input/integrity/write failure |
| `resolve` | All identities selected, no pending/quarantined rows | Deferred/unresolved/pending/quarantined rows | Invalid plan or snapshot |
| `legacy-scores` | Every row preserved as a shape-valid historical output | Pending/quarantined rows retained | Whole-input/plan failure |
| `apply`, `apply-verify`, read-selector commands | Local operation/state verified | Not used | Usage, integrity, stale-head or I/O failure |

Do not discard JSON merely because a command exits 1. Do not interpret exit 0 as a
research-ready or publication-safe result. For exact budgets and error details, use the
linked individual command contracts; profile commands have their own exit semantics.

Interrupted application can resume using the same ledger and decisions after its intent
is committed. Existing bytes must match. Completed stores with altered or missing files
fail instead of being automatically repaired. A directory left before a valid intent
exists requires inspection or a new output path. Verification is read-only.

After an interrupted selector command, inspect its current state before retrying. A
transition might already be committed even if the command failed afterward. Expected-head
checks prevent blindly replaying the old selection. Private directories, regular files,
trusted parent paths and same-volume hard-link support are required for the local write
workflows. Their atomic publication is not a universal power-loss durability guarantee.

## 7. Evaluate and display the adopted record

Migration and evaluation are independent stages. Choose the path appropriate to the
record rather than adding declarations solely to satisfy a profile:

| Path | Entry point | Scope and limitation |
| --- | --- | --- |
| Instrument research | `packet validate` | Checks declared acquisition/research prerequisites and available artifacts; scientific validity remains unchecked. |
| Released documents | `profile check` with `released-documents:0.1.0` | Citation, supplied bytes and direct-extraction provenance, not authenticity or factual accuracy. |
| Historical testimony | `profile check` with `historical-testimony:0.1.0` | Account/extraction provenance, not witness identity, accuracy or independence. |
| Physical samples | `profile check` with `physical-samples:0.1.0` | Declared collected-specimen and custody records, not specimen identity, composition or complete custody. |

`profile list` explains applicability. `profile inspect` reads only the manifest;
`profile check` checks supplied inputs. Existing histories, selections, manifests and
assets must be authored separately: a migration store is not automatically a profile
bundle. See [profile preparation](profile-preparation.md) and [evaluation limits](evaluation-checkpoint.md).

Display measurements, source assertions, assessments, documentary gaps and disagreement
separately. Keep historical scores outside v2 rankings. Unsigned receipts pin bytes;
replay demonstrates the selected implementation's output, including failures. Neither
proves source authenticity, independent scientific reproduction or original execution.

## 8. Adoption boundary and remaining gate

A developer can now inventory v1 records, review supported mappings, retain revisions,
materialize and verify a private store, and control a local read selector with rollback.
The broad remaining work is intentionally outside this migration boundary: additional
native-file conversions, Index storage/reader integration, public projection, browser UX,
partner mapping review, independent semantic reproduction and stable publication.

The [WP09 acceptance record](migration-closeout.md) now documents the completed bounded
local migration scope, runnable end-to-end checks and retained limitations. The next
milestone is WP10 consumer integration, using a bounded partner slice when available
and explicitly labeled fixtures before then. Production migration, public projection
and scientific validation remain separate gates.
