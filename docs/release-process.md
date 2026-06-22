# Release Process

Short playbook for versioning and releasing DisclosureOS foundation packages.

## Release track

**Foundation `@disclosureos/*` (v1, stable):** `records`, `observables`, `origins`, `scoring`, `schema`, and `cli` are published at **`1.0.0`+** under strict [Semantic Versioning](https://semver.org/) — breaking changes ship only in a major bump. These are ESM-only, gated by `publint` + `attw` (`pnpm --filter <pkg> lint:publish`) on every publish, and require Node `>=20`.

## Versioning and changelog

### Package bump policy

Standard semver applies:

- **Patch:** Bug fixes, docs, non-breaking tweaks.
- **Minor:** New backward-compatible features (including `@experimental`-tagged API changes).
- **Major:** Breaking API/schema changes. Bumping a layer schema may also bump the composed `@disclosureos/schema` artifact — version and drift-test both.

### Changesets

- **Per PR:** Add a changeset when your PR changes user-facing behavior or fixes a bug that should appear in the changelog. Run `pnpm changeset` (from repo root) and choose the affected packages and bump type.
- **Location:** Changesets live in the single, workspace-wide root **`.changeset/`**
  directory and cover all published `@disclosureos/*` packages. Private packages —
  the Next apps and `@disclosureos/examples` — are excluded automatically. The
  source monorepo config may also list internal app packages in `ignore` so the
  DisclosureOS release command cannot publish non-standard workspaces by accident.
- **Release:** When cutting a release, run `pnpm version-packages` (`changeset version`) to consume changesets, bump versions, and update CHANGELOGs, then `pnpm release` (`changeset publish`).

## Schema hosting (`os.disclosure.org`)

The foundation packages emit JSON Schema whose `$id` URLs are **resolvable** at the
`os.disclosure.org` host. Each schema's committed file maps to a version-pinned URL:

| Committed file | Hosted URL (`$id`) |
|---|---|
| `packages/disclosureos-records/schema/records.schema.json` | `https://os.disclosure.org/schema/records/1.0.0/observation.json` |
| `packages/disclosureos-observables/schema/observables.schema.json` | `https://os.disclosure.org/schema/observables/2.0.0/observable-assessments.json` |
| `packages/disclosureos-origins/schema/origins.schema.json` | `https://os.disclosure.org/schema/origins/2.0.0/origin-classification.json` |
| `packages/disclosureos-scoring/schema/scoring.schema.json` | `https://os.disclosure.org/schema/scoring/2.0.0/scoring.json` |
| `packages/disclosureos-schema/schema/enriched-observation.schema.json` | `https://os.disclosure.org/schema/schema/1.0.0/enriched-observation.json` |
| `llms.txt` (repo root) | `https://os.disclosure.org/llms.txt` |

Hosting rules:

- **Static + cache-friendly.** These are immutable static files. A given version path
  (e.g. `…/records/1.0.0/observation.json`) never changes content; publish new content
  only under a new version path. Serve with long-lived cache headers and
  `Content-Type: application/schema+json` (or `application/json`).
- **Publish on schema change.** When `SCHEMA_HOST`, a layer schema, or the composed
  schema changes, re-emit (`pnpm --filter <pkg> emit:schema`), let the drift tests pass,
  then copy each committed file to its hosted path above (note the filename differs from
  the committed name — it follows the `$id`). Versioned paths mean old consumers keep
  resolving the schema they pinned.

## Public repository export

The canonical public GitHub repo for the standard is
`disclosurefoundation/disclosureos`. It is a package-only monorepo: foundation
packages, examples, release docs, package CI, and support config. It intentionally
does **not** include `apps/disclosureos` or any other website/dashboard app.

Generate a clean local preview before creating or updating the public repo:

```bash
pnpm export:disclosureos ../disclosureos-public-preview --force
```

The export writes package-only root workspace files, copies the six
`@disclosureos/*` packages plus the private `@repo/typescript-config` support
package, and pins the validated Vitest version in the generated root
`package.json` so installs do not drift to an unvalidated test toolchain.

Validate the exported repo from its root:

```bash
pnpm install
pnpm --filter "@disclosureos/*" build
pnpm --filter "@disclosureos/*" test run
pnpm --filter "@disclosureos/*" run lint:publish
pnpm --filter @disclosureos/examples type-check
pnpm --filter @disclosureos/examples golden-path
```

Commit the generated `pnpm-lock.yaml` in the public repo after validation. The
package quality workflow uses `pnpm install --frozen-lockfile`.

## Cutting a release (manual)

1. Ensure all changesets for the release are merged and CI is green.
2. Run `pnpm changeset version` (from repo root). Review updated version fields and CHANGELOGs; commit.
3. Publish: `pnpm release` (`changeset publish`) or `pnpm -r publish --no-git-tag` for each package you ship. Tag in the repo as needed.
4. Before **first** publish of a package: run `npm pack` in that package, then `npm install <path-to-tarball>` in a temp dir and confirm install + type resolution (dry-run). Do a quick NPM metadata pass (`description`, `keywords`, `repository`, `bugs`, `license`, `files`, `exports`).

## Checklist before a release

- [ ] All changesets for the release are merged.
- [ ] Version bumps and CHANGELOGs are applied.
- [ ] CI is green (packages quality workflow, docs quality workflow).
- [ ] If any foundation schema (`$id`/host/layer/composed) changed: re-emit, confirm drift tests pass, and publish the updated files (and `llms.txt`) to their `os.disclosure.org` paths (see [Schema hosting](#schema-hosting-osdisclosureorg)).
- [ ] If creating or syncing the public GitHub repo: regenerate and validate the
  package-only export (see [Public repository export](#public-repository-export)).
- [ ] Package metadata and docs reflect current naming and versioning.
