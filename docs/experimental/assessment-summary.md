# Experimental assessment summaries

`@disclosureos/scoring/experimental/v2` now exports `summarizeClaimHistory`.
It is the first WP08 evaluation increment: a deterministic description of current
attributed declarations, revision history and shared inputs. It does not calculate
an aggregate score or replace any existing v1 scoring entry point.

## Run the synthetic example

Build the local packages, then invoke the source build:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/scoring...' build
node --input-type=module <<'JS'
import { readFileSync } from 'node:fs';
import { summarizeClaimHistory } from './packages/disclosureos-scoring/dist/experimental/v2/index.js';
const history = JSON.parse(readFileSync('examples/v2/claim-history.json', 'utf8'));
console.log(JSON.stringify(summarizeClaimHistory(history), null, 2));
JS
```

Installed consumers use the opt-in entry point:

```ts
import { summarizeClaimHistory } from '@disclosureos/scoring/experimental/v2';
const summary = summarizeClaimHistory(input);
```

No callback policies, network retrieval, method execution or file verification
occur. The evaluator delegates structural and semantic validation to the existing
records-owned claim-history parser. Invalid histories return the same checks and
diagnostics with empty summaries. `success` means that the history passed those
checks and could be summarized; `checks.profile` and `checks.external` remain
`not_checked`.

## What the result means

`policy` identifies `urn:disclosureos:experimental:policy:assessment-summary`,
version `0.1.0`, scope `current_declared_assessments`. `contract` pins the parsed
claim-history schema and ruleset. History and observation IDs identify the local
input document but are not content digests.

Each `groups` entry has one exact topic string and subject. A measurement subject
and an observation subject never share an outcome group. Source assertions,
unassessed entries and assessed declarations are separate arrays. Missing domains
produce no group and cannot lower another group's result. Origin interpretations
receive no special boost or suppression. Topics are not inferred to be equivalent,
and vocabulary membership is unchecked.

`declaredOutcomes` is the sorted set of assessed outcome labels in that group.
`disagreement` describes whether there are no assessed outcomes, one distinct
label, or multiple distinct labels. It is not a contradiction detector: confirmed
and inconclusive statements can differ without being logically contradictory.
No majority, winning evaluator, average confidence, confidence interval, probability
of anomaly, or overall grade is computed. Different confidence values do not by
themselves change the outcome-label classification; each remains visible in its
declaration. Omitted confidence stays omitted, and zero stays zero.

Source text saying “confirmed” remains a source assertion. An evaluator's assessed
“confirmed” outcome remains that evaluator's declaration even when its input list
is empty. Structural acceptance does not establish documentary support or research
eligibility. Use the separate schema-owned profiles for those checks; this function
does not accept a caller-supplied eligibility flag as proof.

## Revisions and exact duplicate declarations

The records parser determines currentness through explicit supersession links.
Superseded entries are listed in `supersededClaimRefs` and excluded from current
outcome summaries. Branches remain current until another explicit revision
supersedes them. Array order and recording timestamps never pick a winning branch.

Within a topic/subject and claim kind, exact declaration copies are collapsed:

- Ignore only the document-local ID, recording timestamp and supersession list
  after currentness has been resolved.
- Compare every remaining field, including attribution, evaluation timestamp,
  method/version, rationale, confidence, source provenance and source text.
- Treat `inputRefs` as an unordered set, as required by their existing semantics.
  The parser rejects duplicate references within a single list.
- Keep sorted `claimRefs` for every current copy. The first is the deterministic
  representative used by shared-input diagnostics.

Adding an exact copy can expand provenance references, but cannot change distinct
outcomes, disagreement, or the number of unique declaration entries. Repeating the
same ID is an invalid history rather than an additional vote. Differences in
attribution, time spelling, rationale, method or input IDs are preserved; this
policy does not infer semantic equivalence, authenticate evaluators or deduplicate
paraphrases. Different evaluations with the same conclusion remain separate.

## Shared support and dependence

Each assessed declaration includes sorted `lineageRefs`. Traversal follows:

- Claim input references, or a source assertion's provenance source.
- Measurement primary source references and factual assertions' provenance.
- Raw products' source references and derived products' processing inputs.

Supersession and uncertainty annotations are not primary-support edges. If a
current claim explicitly cites a superseded claim as an input, that older claim's
support is still followed without making the older claim current. Traversal is
iterative and uses visited sets.

`sharedInputs` lists references reached by two or more distinct assessed
entries, including across topic groups. Exact duplicate copies contribute once.
`sharedDeclaredArtifacts` additionally discloses equal declared SHA-256 values,
including different source/product IDs. These hashes are not verified here.
Shared source, product and processing entries can describe overlapping parts of
the same dependency chain; do not sum their counts as separate dependencies.

No reported overlap means only that this traversal found none. It does not prove
statistical independence, different witnesses, different acquisition hardware or
independent processing. Unnamed common causes, missing provenance, aliases without
hashes, methods and uncertainty-only references can still imply dependence.

## Limits and next steps

`scientificEligibility`, `artifactIntegrity`, `vocabularyMembership`,
`statisticalIndependence` and `reproducibility` remain `not_checked`. The function
accepts a parsed input value, not source bytes, and does not produce a certified
reproducibility record. Pin the original bytes, schemas, vocabularies, policies,
methods and environment before claiming reproducible evaluation. The output is
not a public projection: it can contain restricted source text, evaluator labels,
input references and rationale from the supplied history.

The current implementation traverses declared support per unique assessment;
large dense histories may require substantial memory and time. Callers should
bound untrusted inputs before parsing. The function does not impose an arbitrary
scientific limit on claim counts.

`pnpm test:v2-summary` covers duplicate invariance, revision branches, missing and
zero confidence, topic/subject isolation, shared transitive support, digest aliases,
unsupported declarations, parser parity, order invariance and long histories.

Remaining WP08 work includes clearly labeled population coverage, applicable
required/recommended profile completion and next actions, integration of documentary
and instrument checks, and versioned evaluation provenance. Legacy score migration,
CLI/Index presentation and scientific review remain separate increments. No
aggregate replacement policy or package publication is included here.

The schema-owned [documentation completion checklist](documentation-completion.md)
now supplies per-assessment required-input statuses and next actions by invoking
the existing documentary validator. It remains separate from declaration summaries.
