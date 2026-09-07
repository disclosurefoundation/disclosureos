# RFC 0002: Explicit missingness and competing values

Status: proposed v2 contract. Owner: records. JSON below illustrates new shapes; it is not accepted by v1 validators.

## Decision and example

Use a discriminated value envelope for event time and position:

```json
{
  "eventTime": { "state": "unknown", "reason": "not_recorded" },
  "position": { "state": "redacted", "reason": "publication_policy" }
}
```

`known` requires a typed value and a source reference. `approximate` requires a typed value or interval, a source reference, and an explicit precision or uncertainty description. `unknown` and `redacted` MUST NOT carry a value or sorting anchor. Unknown reasons include `not_recorded`, `not_collected`, and `unavailable`; they are not synonyms. A redaction indicates withheld information, not a measurement of absence. `not_applicable` is permitted only by a field-specific profile rule with a rationale; observation time and terrestrial position do not automatically acquire that state.

```json
{
  "state": "known",
  "value": { "latitude": 0, "longitude": 0, "datum": "WGS84" },
  "sourceRefs": ["assertion:position-1"]
}
```

Zero is a real value. Known describes whether a value was supplied, not whether it is scientifically correct. Measurement uncertainty belongs beside the measurement; a supplied value with unknown uncertainty may pass structural checks and fail an analysis profile.

Dates express calendar precision; instants express timezone/offset and fractional precision. Do not coerce a year into January 1 or a date into midnight. Acquisition time, record creation time, and processing time remain separate. Preserve native timestamp strings and declared time scale in provenance; no universal nanosecond conversion is required for interchange. Ordering/indexing helpers are derived metadata and MUST NOT be exported as source measurements.

Competing estimates are separate attributed assertions. A curator may select a display value only by recording the selection method and input assertion IDs; alternatives remain exportable. Confidence is optional and omission means unknown. Not-applicable data must not count as a missing requirement when a profile establishes inapplicability.

## Migration cases

| v1 input | v2 action |
| --- | --- |
| Missing date or position | Emit explicit unknown state and a mapping diagnostic. |
| `0,0` or `1900-01-01` | Preserve unless provenance proves a sentinel; otherwise flag for review. |
| Rounded coordinates | Preserve stated precision; do not infer exact location. |
| Explicitly withheld position | Emit redacted state without the restricted value. |
| Contradictory source estimates | Preserve each assertion and source locator. |

Migration MUST write a new artifact, retain a source digest, and account for each input as migrated or quarantined. Missingness never authorizes invention of dates, evaluators, units, uncertainty, or coordinates. Public projection excludes restricted payloads and private notes by allowlist, not by merely hiding their interface elements.

## Implementation checkpoint

The [experimental records primitives](../experimental/records-v2-primitives.md) implement known/approximate/unknown/redacted values, partial calendar precision, WGS84 coordinates, and local assertion provenance checks. They do not yet implement interval-valued estimates, profile-controlled not-applicable fields, curated selection methods, or the migrator. The separate experimental schema URN does not freeze the final v2 Observation contract.
