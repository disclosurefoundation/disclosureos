# DisclosureOS

[![Packages Quality](https://github.com/disclosurefoundation/disclosureos/actions/workflows/packages-quality.yml/badge.svg)](https://github.com/disclosurefoundation/disclosureos/actions/workflows/packages-quality.yml)

DisclosureOS is an open standard for documenting, classifying, and evaluating UAP
observations from the public record. It provides a shared vocabulary, portable
schemas, and reference tooling for researchers, journalists, archivists, and civic
technology teams working with anomalous observation records.

This repository is the package-only monorepo for the standard. The public
documentation and schema host live at [os.disclosure.org](https://os.disclosure.org).

## What Is Included

| Package | Role |
|---|---|
| `@disclosureos/records` | The shared observation vocabulary: what was observed, when, where, and with what supporting record. |
| `@disclosureos/observables` | Technology and biologics observable assessments: what anomalous characteristics were reported or confirmed. |
| `@disclosureos/origins` | Origin Classification System taxonomy and reference mappings. |
| `@disclosureos/schema` | The portable enriched Observation contract for TypeScript and JSON Schema. |
| `@disclosureos/scoring` | Reference completeness and compellingness scoring. |
| `@disclosureos/cli` | Developer tools for scaffolding, validating, scoring, and inspecting observations. |

Supporting workspaces:

- `@disclosureos/examples` provides runnable examples for the full records to scoring path.
- `@repo/typescript-config` is private workspace support for package builds.

## Repository Scope

This repo contains only the open standard packages, examples, release
infrastructure, and package CI. It does not include the `os.disclosure.org` website
or any Disclosure Foundation dashboard applications.

## Local Development

```bash
pnpm install
pnpm --filter "@disclosureos/*" build
pnpm --filter "@disclosureos/*" test run
pnpm --filter "@disclosureos/*" run lint:publish
pnpm --filter @disclosureos/examples golden-path
```

The canonical end-to-end example is [examples/golden-path.ts](examples/golden-path.ts).

## Package Usage

The packages are prepared for publication under the `@disclosureos` npm scope.
After the initial npm release, consumers will be able to install only the surfaces
they need, for example:

```bash
pnpm add @disclosureos/records @disclosureos/schema
```

Until that release is live, use this repository directly for local development and
validation.

## Schema Host

DisclosureOS packages emit JSON Schema with stable `$id` URLs under
`https://os.disclosure.org/schema/...`. See
[docs/release-process.md](docs/release-process.md) for the schema hosting and
release checklist.

## Release

Package releases are managed with Changesets from the workspace root:

```bash
pnpm changeset
pnpm version-packages
pnpm release
```

Every published package is gated by build, type-check, unit/schema drift tests,
`publint`, `attw`, and `npm pack --dry-run` through the package quality workflow.

## License

MIT © Disclosure Foundation
