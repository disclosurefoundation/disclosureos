# DisclosureOS

Open schemas and tools for research records about unidentified anomalous phenomena.
Describe an observation, connect its source material and retain attributed reviews
without replacing the original information.

This branch prepares **2.0.0-beta.4**. It is a release candidate, not a publication
announcement. The current published beta is **2.0.0-beta.3**; unversioned installs
select v1 through `latest`. See the [candidate release notes](https://github.com/disclosurefoundation/disclosureos/blob/codex/beta4-release-closure/docs/releases/2.0.0-beta.4.md)
for scope and verification. Use one exact package version throughout an application.

[Understand the standard](https://os.disclosure.org/v2/standard) ·
[See the working showcase](https://os.disclosure.org/showcase) ·
[Build with the documentation](https://os.disclosure.org/v2/docs)

## How the standard fits together

| Area | What it describes | Implementation entrance |
| --- | --- | --- |
| Records | Observations, sources, accounts, documents, specimens and cases | `@disclosureos/records/experimental/v2` |
| Instruments | Equipment revisions, captures, timing and calibration context | `@disclosureos/instruments/experimental/v2` |
| Observables | Characteristics reported or investigated | `@disclosureos/observables` catalog exports |
| Claims | Attributed assessments with separate subjects and supporting inputs | `@disclosureos/records/experimental/v2` |
| Origins | Named hypotheses, their definitions and qualifications | `@disclosureos/origins` catalog exports |
| Scoring | Provider policies, results, comparisons and bounded checks | `@disclosureos/scoring/experimental/v2` |

These are related capabilities, not six required steps. Start with one observation
and add only the documents your application needs. `@disclosureos/schema/experimental/v2`
provides cross-document evaluators, source readers and instrument profiles;
`@disclosureos/cli` provides explicit local commands. A successful structural check
does not establish authenticity, calibration, scientific validity or an origin.

## Install and try it

For the currently published first-record tutorial:

```sh
npm install --save-exact @disclosureos/records@2.0.0-beta.3
```

Save this as `first-record.mjs`, then run `node first-record.mjs` with Node.js 22:

```js
import { parseExperimentalObservation } from '@disclosureos/records/experimental/v2';

const observation = {
  kind: 'observation', schemaVersion: '0.1.0', id: 'first-observation',
  status: 'draft', createdAt: '2026-10-17T00:00:00Z', updatedAt: '2026-10-17T00:00:00Z',
  eventTime: { state: 'unknown', reason: 'not_recorded' },
  position: { state: 'unknown', reason: 'not_collected' },
  sources: [], products: [], methods: [], frames: [], assertions: [],
  measurements: [], processing: [],
};

const result = parseExperimentalObservation(observation);
console.log(JSON.stringify({ success: result.success, checks: result.checks }, null, 2));
```

The result has `success: true`, structural and semantic checks `passed`, and
profile and external checks `not_checked`. An empty draft is structurally valid;
it is not a complete research record or a verified observation. Change the status
to `finished` to see a failed structural check, then inspect `result.issues`.

The document's `schemaVersion` and each schema identifier are independent of the
npm package version. The `/experimental/v2` import path is intentional in this beta.

## Continue from a working example

- [Add sources and measurements](https://os.disclosure.org/v2/docs/records).
- [Run the complete viewer](https://os.disclosure.org/v2/docs/showcase).
- [Check equipment and captures](https://os.disclosure.org/v2/docs/instruments).
- [Review availability](https://os.disclosure.org/v2/docs/installation). Advanced examples identify their exact source revision until that code is published.

The showcase is fictional reference data. It demonstrates the data structures and
interactions, not a real anomalous event or independent validation of the standard.
The public ELDÆON preview is separate from the partner's pending native archive.

## Work on the candidate

Use Node.js 22 and pnpm 9.15.0 from a checkout of the reviewed branch:

```sh
pnpm install --frozen-lockfile
pnpm --filter '@disclosureos/*' build
pnpm --filter '@disclosureos/*' test run
pnpm test:release
pnpm release:check
pnpm release:pack /absolute/new/candidate-directory
```

Packing verifies a fresh consumer and writes an artifact manifest; it does not
publish. Source examples live under `examples/v2` and the instrument-profile
example directories. `examples/golden-path.ts` exercises the earlier enriched
Observation API, not the recommended V2 starting path.

[Contribute](CONTRIBUTING.md) · [Report a security issue](SECURITY.md) ·
[Release process](docs/release-process.md) · [MIT license](LICENSE)

This repository contains the standard packages. The public portal and reference
viewer are maintained in the separate disclosurefoundation/dashboard repository.
