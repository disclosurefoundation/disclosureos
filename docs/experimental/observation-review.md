# Review observations with unknown processing times

Status: unpublished Beta 5 source work. Merges and npm publication remain on hold.
The published `2.0.0-beta.4` packages do not contain these APIs.

A derived recording can retain its inputs, outputs, actor and method even when
its processing date was not recorded. Observation `0.2.0` preserves that missing
information. This checkpoint allows an attributed review of that observation and
an exact snapshot of it inside a connected case.

The processing date and the assessment date describe different activities. A
reviewer may know when they assessed a recording without knowing when its
preparer processed it. The example retains an exact assessment date and an
explicit unknown processing date. Neither is substituted for the other.

## Choose an explicit contract

| Document | Revision | Contents | Parser in `@disclosureos/records/experimental/v2` |
| --- | --- | --- | --- |
| Observation claim history | `0.6.0` | Observation `0.2.0`, source statements, observation/measurement assessments and revisions | `parseObservationClaimHistory` |
| Case record | `0.2.0` | Case entities and exact references to Observation `0.1.0` or `0.2.0` | `parseCaseRecordV02` |
| Case claim history | `0.2.0` | Attributed case assessments and exact references to Case record `0.1.0` or `0.2.0` | `parseCaseClaimHistoryV02` |
| Claim review evaluation request | `0.1.0` | An exact reference to either new claim history above | `ClaimReviewEvaluationSchema.safeParse` in `@disclosureos/schema/experimental/v2` |
| Claim review receipt | `0.1.0` | Input inventory and computed result, with canonical serialization and digests | `ClaimReviewReceiptSchema.safeParse` in `@disclosureos/schema/experimental/v2` |

The `0.6.0` history is an explicitly selected **observation-level** contract. It
extends the subjects of history `0.1.0`; it is not a universal replacement for
the specialized context, witness, archival, material and laboratory histories
`0.2.0` through `0.5.0`. Those envelopes remain pinned to Observation `0.1.0`.
Unknown processing dates are not silently inserted into those contracts.

All existing schema artifacts and unversioned schema export aliases are
unchanged. New JSON Schema exports are:

```text
@disclosureos/records/experimental/v2/claims/schema/0.6.0
@disclosureos/records/experimental/v2/case/schema/0.2.0
@disclosureos/records/experimental/v2/case-claims/schema/0.2.0
@disclosureos/schema/experimental/v2/claim-review-evaluation/schema/0.1.0
@disclosureos/schema/experimental/v2/claim-review-receipt/schema/0.1.0
```

## Run the complete example

From this source checkout, after installing dependencies:

```sh
pnpm build
node examples/v2/unknown-processing-review/run.mjs
pnpm test:v2-review-evaluation
```

[The fixture](../../examples/v2/unknown-processing-review/fixture.mjs) contains
only synthetic data: one observation with an unknown processing time, one with
an exact time, an observation review, and a mixed-revision case review. It
retains source access as `restricted` to demonstrate that evaluation does not
change access policy. No partner data is copied into the packages.

[The runnable reader](../../examples/v2/unknown-processing-review/run.mjs) uses
only public package imports. The source-pack gate installs all seven tarballs
into an independent consumer and runs the same reader there.

## Evaluate and reproduce a review

```js
import {
  evaluateClaimReview,
  verifyClaimReviewReceipt,
} from '@disclosureos/schema/experimental/v2';

// request.review pins documentId, exact schemaId and sha256.
// Keep the original bytes. Parsing and reserializing can change the digest.
const options = {
  reviewBytes,
  documents, // Map<SHA-256, Uint8Array>: case and observation snapshots
  assets,    // Map<local product/source reference, Uint8Array>: observation support
};
const result = await evaluateClaimReview(request, options);
if (result.receipt) {
  const intact = await verifyClaimReviewReceipt(result.receipt);
  const replay = await evaluateClaimReview(request, options);
  const reproduced = intact &&
    replay.receipt?.input.sha256 === result.receipt.input.sha256 &&
    replay.receipt?.output.sha256 === result.receipt.output.sha256;
}
```

These SDK APIs run offline with Web Crypto available (supported Node runtimes or
a secure browser context). They do not fetch source URLs or grant access to
restricted files. Caller-owned requests and byte buffers are captured before
asynchronous evaluation. A missing or altered snapshot cannot pass. A matching
ID and hash cannot compensate for a wrong declared schema revision.

For observation histories, `evaluateObservationClaimDocumentation()` runs
assessment-documentation profile `0.2.0`. It follows declared source/product
lineage and checks supplied bytes against product digests. It lists unknown
processing dates in `unknownProcessingTimes`. The profile retains its existing
outcome requirements; a `confirmed` claim cannot bypass its missing time or
measurement uncertainty requirements.

For cases, `evaluateCaseRecordV02()` and `evaluateCaseClaimHistoryV02()` resolve
exact case/observation snapshots and validate declared subjects, inputs, methods,
revision attribution and references. Case review checks snapshot integrity; it
does **not** run the observation documentary profile or verify underlying source
artifact bytes. Supplying `assets` to a case request records their inventory but
does not make them verified case inputs.

Read `output.checks` and the detailed issues as well as the outer result. The
outer `checks.external` concerns the review snapshot itself. A valid review may
produce a failed or incomplete evaluation and still receive a reproducible
receipt. Structurally invalid requests or invalid review snapshots do not receive
one.

## What a receipt establishes

A receipt identifies the evaluation policy and includes sorted JSON strings for
the supplied input inventory and computed output. Map entries are ordered by key;
object keys are ordered lexically; array order is retained. Strings and numbers
use JSON serialization, then UTF-8 encoding. The serialization identifier is
`sorted-json-utf8:0.1.0`. Every supplied asset/document buffer contributes its
length and digest to the input inventory, including unreferenced ones.

`verifyClaimReviewReceipt()` checks the serialized receipt's internal integrity.
It does not authenticate a reviewer or prove the evaluator was executed. To
verify the computation, obtain the original review, documents and assets, rerun
`evaluateClaimReview()`, and compare both input and output digests. A self-consistent
receipt can describe a failed result. The example verifies replay separately
from receipt integrity.

Processing chronology, scientific eligibility and publication policy remain
`not_checked`. Neither a passing documentary profile nor a case snapshot check
confirms an anomalous interpretation. The receipt is a review artifact, not a
public redacted projection; review its contents before sharing it.

## Version boundaries and remaining work

This checkpoint is an SDK and JSON Schema addition. It does not change the
legacy CLI dispatch, research-completion/qualification envelopes, reproduction
packets, scoring inputs, case links or public presentation projections. Their
existing APIs retain their explicit contract boundaries. Consumers should use
these new APIs deliberately rather than downgrade an observation or relabel an
existing schema. Extending any of those additional surfaces requires its own
contract review.

Before Beta 5 release approval, reconcile the remaining integration and provider
reviews, verify the published Beta 4 schema-identity baseline, prepare coordinated
package versions only when authorized, and test the exact candidate artifacts
with portal consumers. See the [integration release plan](../releases/beta5-integrations.md).
