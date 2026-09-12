# Connected testimony control

Run `node examples/v2/testimony-case-demo/run.mjs` after building the schema package.
The fixture reuses the existing witness-accounts control: one pseudonym, an event in
Q3 1952, accounts recorded in 1981 and 1990, and a review of reported experience.
No original interview files or fabricated byte receipts are added.

`testimony_case_presentation` 0.1.0 wraps the existing case-presentation contract.
The builder produces public payload 0.3.0 plus JSON, Markdown, metadata and search.
Approval must separately cover the exact full envelope and a policy version.
All declared dependencies are copied before asynchronous validation. Case membership,
research/context/history identities, scoped entity references and matching citations
are checked. Evaluator diagnostics and private fields never reach public outputs.

This bounded contract accepts a selected pseudonym, one known experience declaration
relevant to a selected temporal quarter, single-speaker accounts recorded with year
precision, optionally selected wording/event reference/oath, and a direct-source
reported-qualification assessment with unknown independence. Witness and account IDs
remain kind-scoped; the public witness gets a separate presentation ID. The review
retains current/superseded status. Editorial labels and review summaries are approved
copy, not extracted private names or rationale.

Other identity modes, precision states, conflicting declarations, explicit date
certainty, additional speakers, indirect review chains and independence conclusions
fail closed. Unselected wording and event context are labeled as unselected, not
asserted nonexistent. Procedures remain outside this selection; no polygraph result
or credibility score is inferred. The review does not authenticate identity.

Integrity covers supplied structured snapshots, not original source-file bytes,
scientific validity or publication rights. This is a fictional software rehearsal,
not ELDÆON data or complete testimony-domain acceptance. Npm publication stays deferred.
