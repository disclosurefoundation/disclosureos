# Changesets

This directory is the single, workspace-wide [Changesets](https://github.com/changesets/changesets)
home for the monorepo. It coordinates versioning and changelogs for the published
`@disclosureos/*` packages (records, observables, origins, scoring, schema, cli).

Add a changeset whenever a PR changes user-facing behavior of a published package:

```bash
pnpm changeset
```

Pick the affected packages and the bump type (`patch` / `minor` / `major`), then write
a short, human-readable summary. To version + update changelogs from accumulated
changesets:

```bash
pnpm version-packages   # changeset version
```

See the [Changesets docs](https://github.com/changesets/changesets/blob/main/docs/intro-to-using-changesets.md)
for the full workflow. Private packages (the Next apps) are automatically excluded.
