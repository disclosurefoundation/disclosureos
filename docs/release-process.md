# Release process

## Current release and next milestone

`2.0.0-beta.5` is published for all seven foundation packages under the `beta`
tag. Registry versions, tarball bytes and tags were verified on 2026-11-13.
Stable V1 `latest` tags remain unchanged.

The **initial data integrations** release includes the agreed ELDÆON, Speculor
and Sky360 contract findings. See the [release record](releases/2.0.0-beta.5.md),
[current policy](releases/v2-completion.md) and [scope](releases/beta5-scope.md).

Merge and publication were authorized on 2026-11-13 after candidate verification.
The portal can now pin Beta 5 and update availability language. Provider reuse
permissions and production access boundaries remain separate from this release.

## Canonical ownership and current track

This package-only repository, `disclosurefoundation/disclosureos`, is the
canonical standard source. Website/dashboard applications consume pinned releases.
The reverse application exporter and subtree release workflow are retired.
Never replace this repository with an application snapshot.

The published set is described by the [2.0.0-beta.5 release notes](releases/2.0.0-beta.5.md).
The [Beta 4 notes](releases/2.0.0-beta.4.md) retain the previous release record.
Seven foundation packages are in Changesets prerelease mode with tag `beta`.
Package `publishConfig.tag` also names `beta`. This is not stable publication;
existing npm `latest` tags continue to identify v1 releases.

The ESM packages support Node 20+; the full candidate consumer/conformance workflow
runs on Node 22, while the package matrix also checks Node 20. Keep the pnpm version
pinned by the root `packageManager` field.

## Versioning

Use a changeset for user-facing package behavior. Apply patch/minor/major changes
according to Semantic Versioning; breaking experimental changes must be explicitly
described. During prerelease mode, `pnpm version-packages` advances prerelease
versions and updates changelogs and dependency metadata. Review the result, update
`docs/releases/beta-plan.json`, refresh the lockfile, and commit it together.
Checked-in package versions now name `2.0.0-beta.5`. The release plan pins the
reviewed implementation before version preparation. The registry release uses the exact verified candidate artifacts. The Beta 4
notes retain the historical packaging baseline.

Do not run `changeset pre exit` as routine cleanup. Stable release requires its
own reviewed transition, removal of beta-only publish tags/checks, and completion
of scientific, governance and consumer acceptance gates. If v1 needs a maintenance
release, prepare it from the relevant published package tags in a separate branch;
current main already contains experimental work and is not the v1 release source.

## Unpublished source verification

While publication is held, run `pnpm test:release`, `pnpm verify:source` and
`pnpm verify:source-pack /absolute/new/output-directory` from a clean checkout.
This builds and packs all seven packages, checks their exports, dependencies and
committed schema bytes, and exercises a fresh npm consumer. The manifest is
explicitly a `disclosureos-unpublished-source-candidate` with publication
`not-prepared`. A source-mode manifest is verification-only even when its version matches the
published package. Use the release-mode artifacts for any later authorized publication.

The source mode uses the exact committed HEAD as its schema baseline. It does
not alter the frozen beta plan or weaken the separate `release:check` /
`release:pack` baseline. Before a publishable candidate can pass those release
commands, version the coordinated set and update the release plan as described
above. Release-mode CI now exercises the Beta 5 plan. Passing it does not
authorize a merge or npm publication.

## Candidate preflight

1. Use a clean canonical checkout at the reviewed candidate commit. Install with
   `pnpm install --frozen-lockfile`.
2. Build, type-check and test all seven packages. Run `lint:publish` for strict
   publint/attw checks, the complete conformance corpus, the legacy matrix, example
   checks and migration acceptance. See the commands in the beta notes and CI.
3. Run `pnpm test:release` and `pnpm release:check`. Confirm all packages, internal
   dependencies, changeset state and publication tags agree.
4. Run `pnpm release:pack /absolute/new/output-directory` from a clean tree. It
   packs with pnpm, checks actual export targets and dependencies, then installs
   all seven tarballs into a separate npm consumer and verifies the supported
   workflows. Never publish raw `npm pack` output containing `workspace:` or
   `catalog:` dependencies.
5. Review and archive `release-manifest.json` and its exact tarballs. A passing
   result is software acceptance, not proof of data licensing or scientific truth.

## Authorized beta publication

Publishing is a separate action after review and authorization. Merge does not
publish packages. Prefer the verified tarballs so the bytes being published are
exactly those identified in the candidate manifest.

Before publication, query every package's registry metadata. Confirm the intended
version is unused and record the current `latest` tag. Check package access,
repository metadata, license and two-factor/provenance requirements for the actual
publisher. Do not print credentials or place tokens in release reports.

For each exact, verified tarball in dependency order (records; observables and
origins; instruments; scoring and schema; CLI), use the newly approved version.
For example, only after Beta 5 preparation and publication approval:

```sh
npm publish /absolute/candidate/artifacts/disclosureos-records-2.0.0-beta.5.tgz --tag beta --access public --ignore-scripts
```

Here `--ignore-scripts` applies to an already built, publish-checked and installed
tarball. It is not permission to skip the preflight. Repeat with each package's
actual tarball name; do not run a blanket workspace publish after a partial
failure. If a version already exists, verify its registry integrity against the
candidate; do not overwrite it or assume the previous attempt failed.

Changesets' `pnpm release` is an alternative that builds/publishes from source and
uses the active prerelease tag. If used, verify the resulting registry artifact
hashes against the reviewed candidate before accepting the handoff.

After publication, verify all seven exact versions can be retrieved and installed
without local tarballs. Confirm each `beta` tag and unchanged v1 `latest` tags.
Compare registry tarball integrity/bytes with the candidate manifest. Record
package tags and the source revision in the authorized release record. Package
publication, Git tagging, a GitHub release announcement and website deployment
are separate outcomes.

## Schema and portal handoff

The stable schema artifacts retain their existing `https://os.disclosure.org/schema/...`
IDs. Their individual version numbers need not match package versions. Existing
versioned URLs are immutable. `release:check` and both packing modes compare
current identities against `docs/releases/published-schema-identities.json`, whose
Beta 3 and Beta 4 hashes come from integrity-verified npm tarballs.
After each publication,
append the new identities to that ledger; do not replace earlier entries. New content requires a new identity/path; do not
replace historical files during a package version bump.

Experimental schemas currently use `urn:disclosureos:experimental:...` IDs. They
ship through explicit package exports. The candidate manifest maps each identity
to its path and SHA-256; URNs do not imply a hosted HTTP endpoint. Resolve them
locally through the chosen package set and disclose unchecked external references.

The portal team must pin exact published beta versions and align documentation,
examples, validation, vocabulary and profile definitions with that set. The portal
already defaults to the labeled v2 beta. Keep its pins on the currently published
beta until registry verification passes; preserve v1 routes and immutable schema
URLs. Hosted artifact verification must compare bytes and IDs, not just HTTP status. The public ELDÆON
viewer remains a partner preview throughout this packaging handoff.

## Stable release decision

Stable v2 requires the reviewed disposition of the original audit findings,
independent conformance/exchange and reproduction, partner mapping review,
qualified scientific review, real governance assignments and compatible consumer
migration. Beta package quality alone does not satisfy these gates. Publish the
coordinated stable artifacts and switch the matching portal default only after
that decision is recorded.
