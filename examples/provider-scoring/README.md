# Fictional provider scoring example

This example demonstrates separate provider scores for selected material records
in the DisclosureOS example case. Every provider, judgment and source is
fictional. The seven retained input files are exact copies of existing Meridian
source artifacts; their original paths are listed in `provenance.json`.

No source file or earlier verification receipt has been rewritten to make a score
possible. The copied case record links the field and material records, but the
score concerns the selected material documentation, not the whole investigation.
Only the seven listed input files are reviewed here.

## Run

From the repository root, after dependencies and foundation packages are built:

```bash
node examples/provider-scoring/build.mjs
node examples/provider-scoring/verify.mjs
node --test examples/provider-scoring/model.test.mjs
```

`build.mjs` deterministically authors the two policies and four provider
worksheets, calculates every score with `methods/compute.mjs`, and saves canonical
provider results plus a hash manifest. `verify.mjs` verifies all pinned bytes,
parses the retained record and case contracts, checks selected sources against
the material record, replays the example-specific calculation, and runs the
canonical provider-score evaluator and comparison helper.

## Results

| Result | Method | Calculation | Result |
| --- | --- | --- | --- |
| Review team A | Documentation review 1.0.0 | 25 + 25 + 15 + 20 | 85, B |
| Review team B | Same exact method | 25 + 25 + 0 + 20 | 70, C |
| Review team B | Follow-up priority 1.0.0 | 25 + 30 + 20 | 75, Review soon |
| Review team B, unfinished review | Documentation review 1.0.0 | Required method-detail judgment missing | Unavailable |

The first two results have the same source basis and policy bytes. The provider's
worksheet is deliberately separate: both teams read the same sources but record
different judgments about method detail. Neither rating is an objective software
finding. Replaying the arithmetic establishes what follows from those declared
ratings, not that either team is right.

The third result answers a different question. A shared 0–100 display scale is
not a basis for combining documentation quality and follow-up priority. The
unfinished review retains its missing criterion; it is neither zero nor a score
with a quietly reduced denominator.

The A–D bands are part of this fictional example method. They are not universal
DisclosureOS grades, the Disclosure Index's A–F scale or observable support
levels. Scores say nothing about unusual behavior, biological identity,
extraordinary origin, authentic custody or laboratory validity.

See the [provider scoring format](../../docs/experimental/provider-scoring.md)
for contract semantics and validation boundaries.
