# Fictional laboratory and material review

This source-only example requires the unreleased laboratory checkpoint. It does
not run against npm beta.3. All specimen, laboratory, measurement and reviewer
content is fictional; no ELDÆON laboratory work or scientific conclusion is claimed.

One parent specimen has two derived aliquots. Only aliquot A is analyzed. Its
three result records contain a quantitative measurement with unknown uncertainty,
a below-limit report and qualitative wording. The parent has a selected custody
record; the aliquot's custody gap remains explicit. Two different records retain
the source's quality wording and the reviewer's limitations assessment.

`observation.json`, `entities.json` and `selection.json` are exact supplied
snapshots referenced by `history.json`. The laboratory report itself is only an
inventory declaration; its bytes are not supplied or verified. Never use this
example's placeholder report digest for real source material.

```sh
pnpm --filter "@disclosureos/schema..." build
node examples/v2/laboratory-review-demo/run.mjs
```

The expected output has successful structural, semantic and supplied-snapshot
checks, while profile and scientific/source-artifact checks remain `not_checked`.
The same example runs in the isolated local-tarball consumer. No npm publication
is needed for this verification.
