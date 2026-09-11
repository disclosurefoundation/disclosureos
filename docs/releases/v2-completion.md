# Consolidated V2 release policy

Decision: 2026-09-10. Hold all further npm publication until the remainder of the
V2 implementation is complete, so the next package publication is coordinated.
The last published beta remains `2.0.0-beta.3`. Source review checkpoints continue;
merging a checkpoint does not authorize an incremental npm publish.

Accumulate changesets without applying package version bumps at each checkpoint.
Continue builds, conformance, artifact inspection and source-based previews. Keep
public portal dependencies on the published beta until the coordinated release is
verified. Never serve an unreleased contract as though it is in that beta.

Source checkpoints completed (unreleased):

- C2c material identity, collection, physical custody and sample lineage.
- C2c laboratory/preparation detail, quantitative and qualitative results, explicit
  uncertainty/detection limits, attributable quality review and supplied-document
  resolution. The existing collected-specimen profile retains its separate scope.
- C2c full material portal preview, field accounting and worked examples, merged
  in [dashboard #222](https://github.com/disclosurefoundation/dashboard/pull/222).
  The viewer remains unlisted and blocked in production.
- [C3a connected cases](../c3/README.md): sourced chronology, groups, investigations
  and responses with pinned observation scope and supplied-reference checks.
- [C3b case assessments](../c3/assessments.md): exact case/entity/field and directed
  relationship subjects, explicit inputs, independent reviewers and revisions,
  and supplied case/observation snapshot resolution.

Remaining implementation areas:

- C3 additional scoped references, presentation and application
  access/output enforcement, followed by integration acceptance across V2.

At closeout, review the accumulated changesets, choose the coordinated package
version, run the full release/consumer/portal checks, and publish that exact set.
This policy defers publication, not engineering review or useful previews. It does
not turn engineering completion into qualified scientific review or partner data
acceptance. Any stable-release decision retains its own acceptance gates.
