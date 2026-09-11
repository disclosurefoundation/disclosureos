# Witness A: fictional historical-account control

One scoped witness, two accounts, an event quarter and a recording year. All
content is synthetic. This is not ELDÆON data or an actual historical case.

Read `entities.json` alongside `context.json`: Witness A reports five years of
aviation experience relevant to the third quarter of 1952. Recorder A recorded
one account in 1981; Recorder B recorded a retelling in 1990. Unknown oath,
polygraph, identity consent and independence remain unknown. Source bytes are not
provided. The linked observation therefore contains no sensor measurements and
no invented event instant.

`history.json` contains an attributable review of the source declaration. It does
not assign a credibility score or authenticate the witness. The source references
point to the shared observation inventory; every snapshot digest covers the exact
UTF-8 bytes of the accompanying JSON file, including whitespace.

With candidate `@disclosureos/schema` and its candidate dependencies installed:

```sh
node run.mjs
```

A successful run checks supplied snapshots and references. Inspect the separate
`not_checked` fields for scientific interpretation, source-artifact integrity and
profile applicability. Do not send history 0.3.0 to an older testimony evaluator.
These APIs are not yet in npm beta.1. See [the implementation notes](../../../docs/c2/README.md).
