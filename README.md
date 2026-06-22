# DisclosureOS

DisclosureOS is an open standard for documenting, classifying, and evaluating UAP
observations. It is published as a set of composable TypeScript packages under the
`@disclosureos` npm scope.

## Packages

| Package | Purpose |
|---|---|
| `@disclosureos/records` | The shared observation vocabulary: what was observed, when, where, and with what supporting record. |
| `@disclosureos/observables` | Technology and biologics observable assessments: what anomalous characteristics were reported or confirmed. |
| `@disclosureos/origins` | Origin Classification System taxonomy and reference mappings. |
| `@disclosureos/schema` | The portable enriched Observation contract for TypeScript and JSON Schema. |
| `@disclosureos/scoring` | Reference completeness and compellingness scoring. |
| `@disclosureos/cli` | Developer tools for scaffolding, validating, scoring, and inspecting observations. |

## Quick Start

```bash
pnpm install
pnpm --filter "@disclosureos/*" build
pnpm --filter "@disclosureos/*" test run
pnpm --filter @disclosureos/examples golden-path
```

The canonical end-to-end example is [examples/golden-path.ts](examples/golden-path.ts).

## Website

The public documentation and standard explorer live at [os.disclosure.org](https://os.disclosure.org).
That website is maintained separately from this package repository.

## Release

Releases are managed with Changesets from the workspace root:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

See [docs/release-process.md](docs/release-process.md).

## License

MIT © Disclosure Foundation
