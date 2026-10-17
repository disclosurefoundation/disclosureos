# Provider-authored scores

Status: unreleased V2 source candidate. Import this optional format from
`@disclosureos/scoring/experimental/v2` after building this checkout or a release
that includes it. No npm publication is implied.

The standard can retain a score produced by a named provider without making that
provider's method the universal DisclosureOS scoring system. A score travels with
its question, exact policy revision, subject, input scope, supporting files and
provider-specific derivation. Different providers can publish separate results
for the same record.

This format does not replace attributed claims, record validation, documentation
profiles or the retained origin-only reference scorer. It does not calculate an
anomaly score from descriptive observable support.

## Two documents

`ProviderScorePolicySchema` describes a provider's method:

| Field | Meaning |
| --- | --- |
| `id`, `version`, `title` | The method's identity and readable name. Consumers additionally pin the exact serialized policy bytes. |
| `metric` | An identifier, label and the question this score answers. |
| `subjectKinds` | Which kinds of subject the policy accepts. |
| `method` | A description and hash-pinned method artifacts, each with its own identity and revision. Artifacts can contain documentation or code. |
| `applicability` | When the policy is intended to be used. |
| `missingData` | Whether a score must be withheld or a partial result is allowed, with an explanation of that rule. |
| `scale` | A numeric range and optional grade bands, or named ordinal levels. |
| `limitations` | Limits on the method and the conclusions its results can support. |

`ProviderScoreResultSchema` retains one provider's result:

| Field | Meaning |
| --- | --- |
| `provider`, `producedAt` | The provider's declared identity and publication time. These are declarations, not authentication. |
| `policy` | Method identity, revision, SHA-256 digest and byte length of the exact policy document. |
| `subject` | The kind and identifier of the record, case, claim or other supported subject being scored. |
| `inputScope` | The declared scope of the review. A score of selected sources must not be presented as a review of an entire collection. |
| `inputs` | The common source basis, each with a reference, title, media type, digest and byte length. Include the subject snapshot when the result is about that snapshot. |
| `derivation` | Provider-specific worksheets or other derivation artifacts. They are separate from the shared source basis. |
| `applicability` | Whether this particular use is applicable, not applicable or undetermined, and why. |
| `missingInputs` | Required information known to be missing. A missing worksheet judgment can be identified here even when the worksheet file itself is available. |
| `outcome` | A numeric or ordinal result, or an explicit unavailable result with a reason. |
| `limitations` | Limits that apply to this particular result. |

Artifact references are local identifiers, not automatic download instructions.
The evaluator receives bytes through maps keyed by those references; it does not
fetch URLs or execute method artifacts. The caller determines which sources it
is authorized to retrieve.

## Numeric scores, grades and ordinal levels

A numeric scale declares finite minimum and maximum values, its unit, and whether
higher or lower values have the intended ordering. `none` means that no preferred
direction is declared. A number on a 0–100 scale is not automatically a percentage
or a probability.

Numeric grade bands are optional. When supplied, they must be ordered, contiguous
and cover the whole numeric scale without gaps or overlaps. Lower bounds are
inclusive and upper bounds are exclusive, except the last band's maximum, which
is inclusive. A declared `gradeId` must agree with the score's band.

An ordinal scale defines named levels and their descriptions. A result identifies
one of those levels instead of supplying a number. Ordering and meaning belong
to the provider's policy; consumers must not invent numerical distances between
the labels.

The example uses A–D documentation grades to show how a provider can declare its
own bands. They are not DisclosureOS case grades, the Disclosure Index's A–F
policy, or the observable support labels `not_indicated`, `reported`,
`documented`, `measured` and `confirmed`. Observable support describes available
information about a characteristic. Strong support for an ordinary characteristic
does not make an event anomalous.

## Missing information

An unavailable outcome contains a reason and no value. It is not a score of zero.
The available reasons are `missing_inputs`, `not_applicable`, `undetermined` and
`not_calculated`. They must agree with the declared missing information and
applicability state.

The example method uses `withhold`: every required reviewer judgment must be
present before calculation. A method may instead explicitly permit partial
results. That declaration alone does not explain the denominator or missing-data
arithmetic; the method artifacts must do so. The comparison helper conservatively
declines comparisons that include declared missing inputs, including permitted
partial results.

## Check one result

```js
import {
  evaluateProviderScore,
  compareProviderScores,
} from '@disclosureos/scoring/experimental/v2';

const options = {
  policyBytes,       // Uint8Array: exact serialized policy document
  inputFiles,        // Map<artifact ref, Uint8Array>: common source basis
  derivationFiles,   // Map<artifact ref, Uint8Array>: this provider's derivation
  methodFiles,       // Map<artifact ref, Uint8Array>: declared method artifacts
};
const checked = await evaluateProviderScore(resultDocument, options);
// checked.checks: structural, semantic and external
// checked.grade: policy-derived label when applicable
// checked.policyExecution === 'not_checked'
```

Structural checks validate document shapes. Semantic checks validate policy
identity, scale membership, grade bands, applicability, missing-data rules and
local identifier uniqueness. External checks compare supplied bytes against their
declared digests and lengths. Missing bytes remain `not_checked`; changed bytes
fail. A passing result does not authenticate the provider, prove scientific
validity, resolve the subject reference, or establish that the declared method
was executed correctly. Those boundaries are explicit in the return value.

`validateProviderScorePolicy` checks policy structure and semantic rules directly.
`providerScoreGrade` looks up a declared band or ordinal level. It does not
calculate the score or endorse the grade.

## Compare two results

```js
const comparison = await compareProviderScores(leftResult, rightResult, {
  left: leftOptions,
  right: rightOptions,
});
```

The conservative helper returns `eligible_for_comparison` only when both result
documents and required bytes pass, both outcomes are scored, and they have the
same exact policy bytes, subject, input-scope identifier and description, and source-input pins.
Artifact references, media types, digests and lengths are included in the source
basis. Reordering the input list does not change that basis. Provider-specific
derivation files may differ and must still pass their own byte checks.

Other results return `not_eligible` with reasons, such as `different_policy`,
`different_subject`, `different_inputs`, `different_input_scope`,
`unavailable_result`, `incomplete_inputs` or `unverified_result`.

Eligibility means a reader can inspect the declared results on a shared basis.
It does not establish methodological validity or statistical comparability.
The helper does not choose a winner, calculate consensus, average the scores or
rank provider authority. Shared input digests are reported; statistical
independence remains `not_checked`. Different provider names do not turn shared
source material into independent corroboration.

## Reproducible fictional example

Run the [provider scoring example](../../examples/provider-scoring/README.md):

```bash
pnpm --filter @disclosureos/scoring build
node examples/provider-scoring/verify.mjs
node --test examples/provider-scoring/model.test.mjs
```

Two fictional teams use the exact same seven-file material-review scope from the
DisclosureOS example case. They apply one method, but record different judgments
about the completeness of the analytical procedure. Four weights total 100
points. Team A assigns half credit to method detail and receives 85, grade B.
Team B assigns no credit to that criterion and receives 70, grade C. The example
preserves both explanations rather than resolving the difference for the reader.

A third result gives 75 on a different 0–100 follow-up-priority scale. Its question
and policy differ, so the comparison is ineligible. A fourth worksheet has an
unrecorded criterion and produces no score.

The example verifier independently replays only its known local calculation,
compares the saved results, validates the canonical documents, and checks the
retained file pins. This arithmetic replay belongs to the example, not the general
contract validator. It does not justify the authored reviewer judgments or run
arbitrary code supplied by an external provider.

## Exported schemas

- `providerScorePolicyJsonSchema()`:
  `urn:disclosureos:experimental:provider-score-policy:0.1.0`
- `providerScoreResultJsonSchema()`:
  `urn:disclosureos:experimental:provider-score-result:0.1.0`
- `@disclosureos/scoring/experimental/v2/provider-score-policy/schema`
- `@disclosureos/scoring/experimental/v2/provider-score-result/schema`

JSON Schema expresses structural rules. Use the canonical evaluator for the
cross-field semantics and supplied-byte checks described above. Retain the exact
policy revision and serialized bytes when sharing a result; changing the method
or its bands requires a new policy revision and newly pinned result.
