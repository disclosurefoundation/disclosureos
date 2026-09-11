# Fictional two-edition archival control

Every file, marking, party and identifier here is fictional. This is a worked
contract example for C2b, not ELDÆON data or an authenticated archival document.
It requires the candidate records/schema builds; published beta.2 lacks these APIs.

- `memo-a.txt`: a three-page release copy of “Memo A,” control SYN-17.
- `memo-b.txt`: a different four-page edition with the same title.
- `archive-log.txt`: release context; declassification and the original bytes are
  unavailable. A declared legacy MD5 for the original is not the release's hash.
- `observation.json`: source inventory and method declaration.
- `entities.json`: separate editions, digital artifacts, document events, custody
  actions and an attributed identifier accessibility check.
- `history.json`: an edition-specific source statement and an inconclusive review
  comparing page 2 of edition A with page 3 of edition B.

`fixture.mjs` deterministically reproduces all three JSON documents and their
snapshot references. `run.mjs` supplies only observation and entity JSON bytes to
the evaluator. The text files illustrate the inventory; the evaluator does not
read or authenticate them. It does not visit the `.example` URL.

From the repository root with Node 22:

```sh
pnpm --filter '@disclosureos/schema...' build
node examples/v2/archival-editions-demo/run.mjs
pnpm test:v2-archival
```

Expect snapshot/structural/semantic checks to pass, while source artifact integrity,
scientific interpretation and profile applicability remain `not_checked`. The
unknown declassification date, redaction percentage and custody predecessor stay
unknown. Passing checks does not complete custody or authenticate either edition.

See [the contract guide](../../../docs/c2/archival.md) and
[field ledger](../../../docs/c2/archival-baseline-mapping.csv).
