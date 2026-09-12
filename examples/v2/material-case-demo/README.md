# Public material and laboratory case

Run `node examples/v2/material-case-demo/run.mjs` after building the workspace.
The example reuses `laboratory-review-demo` and its specimen-selection snapshot.
It wraps those existing fictional declarations in a case and explicitly approved
public presentation. No new specimen, laboratory work or report file is invented.

The public view retains the parent, split, two aliquots, separate trace, three
result kinds and an attributed review of the numeric result. Numeric uncertainty
and detection thresholds remain separate. Results do not propagate to a parent,
sibling or trace. Custody follows predecessor links and preserves gaps.

The builder validates laboratory history and exact snapshot dependencies,
including specimen selection, before projecting an allowlist. It captures the
selected dependency graph before awaiting. It rejects hidden lineage/analysis
inputs, competing selected declarations, unsupported value states, unsupported
date precision and review inputs outside selected results. All results declared
by a selected analysis and all inputs/outputs of a selected preparation must be
selected in this bounded contract. This is intentionally narrower than the full
material/laboratory standard.

Unknown scalar declarations use a fixed public label; private reason prose,
collector/operator identities, custody parties, laboratory identity, source URLs,
review rationale and review metadata are excluded. Public labels, summaries,
selected descriptions, qualitative result wording and threshold basis are part
of the approved envelope and source selection. Report bytes are not supplied,
so there are no attachments or claims of source-file verification.

An additive material presentation envelope (`0.1.0`) yields public payload
`0.5.0`, JSON, Markdown, metadata and search. Other presentation contracts remain
unchanged. No npm publication or version bump is part of this checkpoint.
