# DisclosureOS

[![Packages Quality](https://github.com/disclosurefoundation/disclosureos/actions/workflows/packages-quality.yml/badge.svg)](https://github.com/disclosurefoundation/disclosureos/actions/workflows/packages-quality.yml)
[![NPM](https://img.shields.io/npm/v/@disclosureos/schema?label=npm)](https://www.npmjs.com/package/@disclosureos/schema)
[![GitHub Release](https://img.shields.io/github/v/release/disclosurefoundation/disclosureos?label=release)](https://github.com/disclosurefoundation/disclosureos/releases)
[![License](https://img.shields.io/github/license/disclosurefoundation/disclosureos)](LICENSE)

DisclosureOS is an open standard for documenting, classifying, and evaluating UAP
observations from the public record. It provides a shared vocabulary, portable
schemas, and reference tooling for researchers, journalists, archivists, and civic
technology teams working with anomalous observation records.

This repository is the package-only monorepo for the standard. The public
documentation and schema host live at [os.disclosure.org](https://os.disclosure.org).

## What Is Included

| Package | Role |
|---|---|
| [`@disclosureos/records`](https://www.npmjs.com/package/@disclosureos/records) | The shared observation vocabulary: what was observed, when, where, and with what supporting record. |
| [`@disclosureos/observables`](https://www.npmjs.com/package/@disclosureos/observables) | Technology and biologics observable assessments: what anomalous characteristics were reported or confirmed. |
| [`@disclosureos/origins`](https://www.npmjs.com/package/@disclosureos/origins) | Origin Classification System taxonomy and reference mappings. |
| [`@disclosureos/schema`](https://www.npmjs.com/package/@disclosureos/schema) | The portable enriched Observation contract for TypeScript and JSON Schema. |
| [`@disclosureos/scoring`](https://www.npmjs.com/package/@disclosureos/scoring) | Reference completeness and compellingness scoring. |
| [`@disclosureos/cli`](https://www.npmjs.com/package/@disclosureos/cli) | Developer tools for scaffolding, validating, scoring, and inspecting observations. |

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

Install only the surfaces you need:

```bash
pnpm add @disclosureos/records @disclosureos/schema
```

Run the CLI without installing it globally:

```bash
pnpm dlx @disclosureos/cli --help
```

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

DisclosureOS packages version independently under Semantic Versioning. Routine
patches can ship as package-level releases and tags (for example,
`@disclosureos/cli@1.0.1`) without a new aggregate GitHub Release. Repository
releases such as `v1.0.0`, `v1.1.0`, or `v2.0.0` mark standard-level milestones
across the framework.

## License

MIT © Disclosure Foundation
