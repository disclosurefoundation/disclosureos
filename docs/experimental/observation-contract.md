# Experimental Observation contract

This is the integrated factual record for the records v2 work, exposed from `@disclosureos/records/experimental/v2`. It connects the earlier value primitives to source/product inventories, reference frames, methods, source assertions, measurements, selections, and processing history. It is an experimental contract for review, not the stable v2 release. The package is not published yet.

The [complete synthetic example](../../examples/v2/observation.json) exercises the whole path. Its values, sources, and processing declarations are illustrative. It contains no partner data and makes no claim that the declared processing was executed.

```ts
import { readFileSync } from 'node:fs';
import { parseExperimentalObservation } from '@disclosureos/records/experimental/v2';

const input: unknown = JSON.parse(readFileSync('observation.json', 'utf8'));
const result = parseExperimentalObservation(input);
console.log(result.checks, result.issues, result.uncheckedRefs);
if (result.success) console.log(result.data);
```

## Record boundary

The root identifies `kind: "observation"`, experimental `schemaVersion: "0.1.0"`, a stable record ID, lifecycle status, and creation/update timestamps. Event time is separate from record metadata and processing timestamps. Update time cannot precede creation time, including at sub-millisecond precision. No timestamps, positions, evaluators, or confidence values are defaulted.

Required inventory arrays may be empty. Unknown/redacted event time and position therefore form a valid archival record without invented values. Known and approximate fields retain the earlier source-reference requirements; approximate fields also declare precision. Arrays for sources, products, methods, frames, assertions, measurements, and processing make the document's reference scope explicit.

Normative objects reject unexpected keys. Namespaced `extensions` preserve arbitrary JSON values without stripping or coercing them. Extension payloads are not semantically validated by the core. The record is not a public projection: source access labels and a redacted field do not automatically remove restricted values elsewhere, including assertions and extensions.

## Quantitative uncertainty

A measured quantity has a signed numerical value, a declared unit string, and an uncertainty object. Uncertainty explicitly distinguishes:

| Kind | Required information |
| --- | --- |
| `unknown` | Reason: not reported, not characterized, or unavailable; no magnitude hidden in the object |
| `standard` | Nonnegative magnitude, unit, and source/product references |
| `expanded` | The same information plus a positive coverage factor; coverage probability is optional and must be supplied explicitly |
| `bound` | Nonnegative bound magnitude, unit, and source/product references |

Coverage factor 2 does not create a 95% probability. No distribution or propagation rule is inferred. Negative physical values, including altitude and signed velocity, are permitted; negative uncertainty magnitudes are not.

Quantity and uncertainty units must match exactly. Units are declarations, not certified UCUM codes, and the parser does not perform conversions or dimensional analysis. Time uncertainty supports `s`, `ms`, `us`, and `ns`, preserving the supplied magnitude/unit. Geographic angular uncertainty is expressed in `deg`; a metric position error must not be silently converted to degrees.

## Reference frames

Geodetic positions preserve latitude/longitude bounds and reference a frame declaring degree units. Optional altitude is a measured quantity and requires a separate vertical-reference declaration with a matching unit. Cartesian positions contain signed x/y/z quantities whose units match the declared frame unit.

Frame definitions can identify an authority/code/revision, give a description, or explicitly state that the definition is unknown. An unknown definition remains visible and does not establish transformability or research eligibility. The parser checks local references, coordinate-system kinds, and declared units. It does not retrieve authoritative CRS definitions, perform coordinate transforms, or certify the adequacy of a described origin or vertical reference.

## Source assertions and curated values

Assertions may concern event time, position, or a named measurement. They retain source locators, optional digest declarations, and separate original-author/extractor identities. Alternative assertions remain intact and are never averaged or promoted to confirmed assessments.

Unlike the earlier permissive primitive container, this Observation requires an explicit selection when a current value cites local assertions. Selection identifies the evaluator, timestamp, method/version, considered inputs, and rationale. Every input must resolve to the correct field/measurement, without duplicates. The selected assertion must be cited and its value copied exactly, including uncertainty where part of that value. Method versions must match the local inventory.

An archive can preserve assertions and leave the current field unknown instead of inventing a curator's choice. Values citing source/product declarations directly do not imply a curated assertion selection. Consistency of those values with the underlying bytes still requires external checks and an appropriate profile.

## Processing history and product lineage

Raw products identify source declarations. Derived products identify one producer. A processing activity declares its method/version, actor, timestamp, input references, and output product references. Inputs may be sources, products, or assertions. Derived products and producer output lists must agree in both directions; a raw product cannot masquerade as a process output.

Local dependency cycles fail, including cycles passing through source assertions. An iterative graph check supports long histories without recursive traversal. Inputs and outputs remain declarations: the parser does not execute a method or verify that an output was actually generated by it.

This is lightweight record-level product/processing metadata. Bulk telemetry, immutable acquisition sessions, instrument/calibration revisions, licensing exchange, reproducible execution environments, and dataset release inventories remain work for the instrument/dataset layer. Native products stay external rather than being converted into a universal telemetry format.

## Validation and verification limits

Results contain `success`, `checks`, typed diagnostic codes, JSON Pointers, severity, and `uncheckedRefs`. Successful parsing means structural and local semantic checks passed. Both `profile` and `external` remain `not_checked`; no network requests occur. Locally declared sources/products/methods/frames are listed as unchecked for underlying content or meaning, even when their IDs resolve.

Missing local declarations, duplicate IDs, mismatched selection/method versions, incompatible units, invalid temporal order, and inconsistent/cyclic lineage produce errors. An assertion's digest is compared with an inventory digest only when both are supplied; neither is verified against bytes by the parser.

JSON Schema expresses structural validity. Local references, units, temporal ordering, curated selection, and lineage checks are semantic and require `parseExperimentalObservation` or an independent implementation of those rules. This records-owned result is not yet the shared CLI/browser/profile orchestration layer from WP06.

The new artifact has its own URN, `urn:disclosureos:experimental:observation:0.1.0`, available through `@disclosureos/records/experimental/v2/observation/schema` and the explicitly versioned `/schema/0.1.0` export. Existing v1 and experimental primitive 0.1/0.2 artifacts remain unchanged. The existing CLI and composed-schema package still target v1; do not submit this document to them as if they already support v2.

## Verification and next work

After building records, run `pnpm emit:v2-observation` to regenerate this artifact explicitly. `pnpm test:v2-observation` compares the committed artifact with the emitter, checks runtime/Ajv structural agreement, expected semantic results, exact JSON round trips, the synthetic example, a long processing chain, and offline-only validation. Portable cases live in `conformance/v2-observation-fixtures.json` as base records plus declared mutations.

This establishes the integrated factual record needed for migration and projection work. It does not complete the standard: migration/quarantine reports, policy-aware public projection, full source-text and assessment claims with revisions/supersession, profile-controlled inapplicability, scientific eligibility rules, dataset/instrument history, independent Python checks, and release review remain outstanding. No v1 migration, partner publication, or scientific certification is implied.

The next additive layer is the [experimental claim history](claim-history.md), which embeds this unchanged Observation contract and adds source statements, assessments, and revision history. It does not grant scientific eligibility or provide public projection.
