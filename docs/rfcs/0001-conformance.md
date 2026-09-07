# RFC 0001: Staged conformance

Status: proposed v2 contract. Owners: records, schema, CLI. Not a published schema or scientific certification.

## Decision

A validator MUST report structural, semantic, and profile outcomes separately. Each outcome is `passed`, `failed`, or `not_checked`. A diagnostic carries `code`, `stage`, `severity` (`error`, `warning`, `info`), `pointer` (RFC 6901 JSON Pointer), and `message`. Results pin document kind, schema ID, rule-set version, and selected profile version. Human messages may improve without changing rule identity.

Structural validation checks document shape, declared field types, enums, and bounds. Semantic validation checks calendar meaning, cross-field constraints, local reference resolution, vocabulary membership, uniqueness, and prohibited cycles. Profile evaluation checks whether a valid record contains the inputs required for a specified use. Structural failure prevents dependent semantic/profile checks; independent findings may still be reported. A skipped or unavailable check MUST NOT appear as passed.

Unexpected properties MUST fail at every normative object boundary. Arbitrary partner payloads belong in a namespaced `extensions` object; validators MUST preserve them unchanged. An unknown extension can pass core structural validation but its own conformance remains not checked. Composition MUST be immutable and explicit; custom compositions get distinct IDs and pin extension schemas. Import order MUST NOT change outcomes.

Local references resolve within the declared document/inventory scope. A malformed reference fails semantics; a missing local target fails semantics. An external target unavailable offline produces `REF.EXTERNAL_UNCHECKED`, even if its syntax is valid. Profiles requiring that target cannot pass. Validation MUST NOT fetch remote URLs implicitly. Duplicate IDs fail within their declared scope; reusing an ID in a different revision is permitted only when revision addressing disambiguates it.

CLI exit 0 means the requested stages completed without errors or required unchecked results. Exit 1 means conformance failure; exit 2 means invocation or operational failure. Without a profile, profile status is not checked. Warnings alone do not fail unless an explicit warnings-as-errors option is selected. The browser must display the same diagnostic codes and pointers; it must not relabel a structural pass as full validation.

## Rule ownership and initial corpus

| Code | Stage | Owner | Normative requirement |
| --- | --- | --- | --- |
| CORE.VALID | structural | records/instruments | Valid minimal documents and real zero or signed coordinates MUST be preserved. |
| STRUCT.UNKNOWN_KEY | structural | schema | Reject unexpected normative keys at every nesting depth. |
| STRUCT.EXTENSION_PRESERVATION | structural | schema | Preserve namespaced extension values without stripping or coercion. |
| TIME.CALENDAR | semantic | records | Present dates MUST exist in the Gregorian calendar, including leap-year rules. |
| TIME.TIMESTAMP | structural | records | Instants MUST include a valid date/time and explicit UTC offset; v2 does not accept locale-dependent strings. |
| NUM.NONNEGATIVE | structural | records/instruments | Duration and uncertainty magnitudes MUST be nonnegative; this rule does not apply to signed positions or signed physical quantities. |
| NUM.CONFIDENCE_RANGE | structural | observables | Supplied normalized confidence MUST be in [0,1]. |
| CLAIM.UNKNOWN_CONFIDENCE | profile | scoring | Omitted confidence MUST remain unknown, never default to 1. |
| VOCAB.ORIGIN_ID | semantic | origins | Hypothesis IDs MUST resolve in the pinned vocabulary. |
| REF.SYNTAX | semantic | records | References MUST follow the declared reference grammar. |
| REF.LOCAL_RESOLUTION | semantic | schema | Local references MUST resolve to actual targets. |
| REF.UNIQUE_ID | semantic | instruments/schema | IDs MUST be unique in their declared scope. |
| REF.EXTERNAL_UNCHECKED | semantic | schema | Unavailable external targets MUST be reported as not checked. |
| PROFILE.CLAIM_SUPPORT | profile | schema/observables | A supported-assessment profile MUST require attribution, method, and appropriate resolvable inputs. |

The executable matrix measures legacy runtime, emitted JSON Schema, and CLI behavior. Those legacy APIs combine stages differently; the matrix MUST NOT label their acceptance booleans as v2 stage results. Profile rules in the corpus identify intended future checks, not implemented scientific support tests. Browser and independent Python checks remain required follow-ups.

## Compatibility

Keep existing v1 APIs and artifacts unchanged during contract development. Add v2 interfaces only once their document boundaries and examples are agreed. Original target rejections for unsupported claims remain rejections for the supported-assessment use case, while the source assertion remains preservable under RFC 0003.
