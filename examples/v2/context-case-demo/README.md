# Connected sensor-context reader control

This fictional example reuses `context-demo` without changing its scientific
inputs. A new case groups the supplied observation and a versioned
`context_case_presentation` selects its station name, reported shapes, unknown
alignment, ambient-temperature binding, two product references and shape review.
The explicit envelope contains the existing 0.1.0 case presentation. Its own
schema is 0.1.0; the extended public-case payload is 0.2.0. Original presentation
parsers and public outputs retain their earlier contracts.

Run `node examples/v2/context-case-demo/run.mjs` after building the workspace.
`buildPublicContextCaseOutputs` verifies the approved envelope bytes, exact case
membership, history/context identities, context evaluator result, selected
assertion inputs and artifact citations. One projection supplies JSON, Markdown,
search and the portal payload. Generic failures contain no record diagnostics.
The publisher must separately authorize exact artifact bytes and serve them
through verified routes. Access labels alone grant no permission.

The public projection selects primitives, approved attribution labels and citation
IDs. It excludes raw documents, source URLs, private identities, histories,
approval data and unselected fields. No raw document is spread into the payload.

## Deliberately bounded support

- Place name, reported shape and collection alignment-description fields support
  known strings and unknown reasons. Approximate, redacted and unmapped values,
  or fields with an explicit selection decision, are rejected until their full
  presentation semantics are supported.
- Measurements select environment bindings with the ambient-temperature role.
  Numeric value, unit and uncertainty remain supplied values. Sources for known
  uncertainty are required citations. Measurement selection decisions are not yet
  supported. The binding does not describe an acquisition method; the output says
  that this method is not supplied rather than inventing one.
- Tracks select existing collection products. This control has fictional text
  artifacts, not telemetry, waveforms or a synchronized video stream.
- Reviews select context-field assessments with direct source/product inputs.
  Every context assertion input must be in the selected field. Claim-chain inputs
  are rejected in this first reader contract. Status and explicit supersession
  survive; a supplied outcome remains an attributed assessment.

Clock alignment, fusion, source authenticity and scientific interpretation remain
unchecked. This is the first connected sensor-context journey, not completion of
all four integrated design cases, a production publishing backend, or native
ELDÆON validation. No npm publication is part of this checkpoint.
