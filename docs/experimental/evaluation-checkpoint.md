# Evaluation implementation checkpoint

The experimental evaluation path now has distinct outputs for field presence,
declared assessments, documented research prerequisites and reproducible computation
receipts. These capabilities are implemented and regression-tested; they do not
constitute a stable v2 release or independently reviewed science.

| Capability                             | Demonstrated scope                                                                                                                                | Important limit                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Population coverage                    | Descriptive name for the compatible legacy field counter                                                                                          | Presence is not applicability or analytical readiness                                                           |
| Assessment summary                     | Current declarations, revisions, exact copies, differing outcomes and shared support                                                              | No aggregate score, confidence default or independence assumption                                               |
| Documentation checklist                | Required documentary inputs and source-based next actions per applicable assessment                                                               | Does not establish scientific adequacy                                                                          |
| Released-document provenance           | Selected document citation, access declarations, local bytes and direct extractions; non-blocking citation recommendations                        | Release authenticity, extraction accuracy and assessment support remain unchecked                               |
| Historical-testimony provenance        | Selected account citation, preserved access, local bytes and speaker/extractor attribution for direct extractions                                 | Speaker identity, account accuracy, firsthand knowledge and witness independence remain unchecked               |
| Physical-sample provenance             | Selected collected-specimen labels, cited collection/current-holder records, supplied handoff continuity and local record bytes                   | Physical identity, genuine/complete custody, chronology, contamination, composition and origin remain unchecked |
| Research checklist                     | Calibration-use, timing, acquisition, documentation and local report prerequisites                                                                | Rejected and unperformed checks retain their status                                                             |
| Research receipts                      | Exact packet/dependency pins and computed prerequisite results with rule identities                                                               | Supplied implementation/environment execution is unattested                                                     |
| Summary receipts                       | Exact claim-history/dependency pins and computed declaration summaries                                                                            | Referenced source/product artifacts remain unverified                                                           |
| Provenance-profile receipts and replay | Exact history, selection, source-file and dependency pins for three fixed profiles; preserved failed/unchecked results                            | Unsigned receipts and current-code replay do not authenticate sources or attest the original execution          |
| Independent integrity verification     | Python checks exact saved payload strings and hashes for all three receipt formats                                                                | Does not independently implement evaluation semantics                                                           |
| CLI profile selection                  | Four-domain catalog and explicit manifest inspection/checking for three provenance workflows, with required/recommended statuses and next actions | No automatic profile choice, guided selection authoring, web/Index UI or public projection                      |
| CLI input preparation                  | Explicit file plans, calculated byte pins, private copies and preserved failed/unchecked receipts                                                 | Requires existing histories and selections; does not invent missing declarations or authenticate dependencies   |
| Local replay                           | Fixed TypeScript evaluators reproduce saved request/output payloads                                                                               | Matching a failed evaluation does not make it pass                                                              |

## WP08 acceptance closeout

WP08 is implementation-complete for the experimental v2 scope. This is a software
checkpoint, not stable promotion or scientific certification. The original acceptance
criteria are covered by these executable checks:

| Acceptance                                                                                         | Repository evidence                                                                                                                    |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Origin labels do not create anomalous support; absent biologics does not suppress another topic    | `conformance/assessment-summary.test.mjs`: topic isolation including hoax and unassessed biologics                                     |
| Missing confidence stays missing; repeated claims do not add support                               | `conformance/assessment-summary.test.mjs`: missing/zero confidence, duplicate and revision cases                                       |
| Differing outcomes are disagreement, not a statistical interval                                    | `conformance/assessment-summary.test.mjs`: declared outcomes and disagreement                                                          |
| Reproducible outputs pin inputs and versioned policies; arbitrary callbacks cannot certify results | `conformance/research-evaluation.test.mjs`, `summary-evaluation.test.mjs`, `profile-evaluation.test.mjs` and `receipt-replay.test.mjs` |
| Four domain paths expose requirements, status and next actions                                     | Research-completion, released-documents, historical-testimony, physical-samples and profile CLI/preparation conformance suites         |

Pinning covers each evaluator's declared inputs. Summary receipts do not verify
referenced source artifacts; receipts are unsigned and do not certify scientific
validity or execution environments. No new default weighted ranking was introduced.

### Follow-ups assigned to later gates

- **WP10:** guided selection authoring, web/Index results, local inspection and public
  projection. Preserve separate declarations, documentary gaps and disagreement.
- **WP11:** qualified profile review, justified recommended inputs, conventional
  controls, partner mapping review and independent semantic reproduction.
- **WP12:** review findings, governance and release gates before stable promotion.
- **Deferred profile extension:** physical derivation, splitting and mixture lineage.
  The collected-specimen profile remains explicitly bounded to its implemented scope.

## Subsequent roadmap gates

WP09 migration must preserve legacy outputs separately and reconcile every record.
WP10 must exercise the package contracts in the website and Index, including local
inspection and traceable export. WP11 still needs independent semantic implementation,
partner mapping review, a real authorized dataset/control/background slice and external
scientific reproduction. Python receipt hashing alone does not close that requirement.
WP12 still needs actual governance assignments, release-candidate checks and authorized
publication. Merging these PRs does not publish packages, schemas, applications or data.

Native partner data, calibration/timing artifacts, permissions and qualified review
remain external dependencies. The synthetic examples demonstrate software behavior;
they are not substitutes for those materials. WP09 begins with the [dry-run migration checkpoint](migration-dry-run.md).
