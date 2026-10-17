# Consolidated V2 release policy

Decision: 2026-09-10. Hold all further npm publication until the remainder of the
V2 implementation is complete, so the next package publication is coordinated.
The last published beta remains `2.0.0-beta.3`. Source review checkpoints continue;
merging a checkpoint does not authorize an incremental npm publish.

At implementation checkpoints, accumulate changesets without incremental version bumps.
The coordinated beta.4 candidate is now prepared for release-mode verification;
see [its scope and gates](2.0.0-beta.4.md). This supersedes version preparation
being on hold, but preserves the holds on merges and npm publication.
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
  The public showcase now includes fictional material and laboratory examples.
- [C3a connected cases](../c3/README.md): sourced chronology, groups, investigations
  and responses with pinned observation scope and supplied-reference checks.
- [C3b case assessments](../c3/assessments.md): exact case/entity/field and directed
  relationship subjects, explicit inputs, independent reviewers and revisions,
  and supplied case/observation snapshot resolution.
- [C3c supplemental links](../c3/links.md): attributable associations to context,
  entity and intake snapshots, exact observation scope and optional inventory
  digest matching, with full research and raw-artifact validation kept separate.

- [C3d public presentation](../c3/presentation.md): approved narrative, citations,
  case findings and media selections with one public projection for rendering,
  downloads, search and metadata. Public portal integration is implemented and
  covered by the coordinated package/guide and browser verification.

Implemented source areas awaiting coordinated publication:

- Product source selection for array layouts, CSV partitions and declared video
  frame intervals, with exact-byte evaluation and a shared reader.
- Connected-case portal integration, server access/output enforcement, instrument
  profiles, vocabulary references and provider scoring. See the beta.4 scope.

The remaining release gates are schema identity preservation, dependency review,
GitHub/npm entry-point clarity and refreshed candidate/guide receipts. After npm
publication and registry verification, make a separate production update to package
pins, inspector support, installation examples and public availability language.
Preserve historical release notes and source receipts rather than rewriting them.

At closeout, review the accumulated changesets, choose the coordinated package
version, run the full release/consumer/portal checks, and publish that exact set.
This policy defers publication, not engineering review or useful previews. It does
not turn engineering completion into qualified scientific review or partner data
acceptance. Any stable-release decision retains its own acceptance gates.
