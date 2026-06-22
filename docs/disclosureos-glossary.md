# DisclosureOS glossary

The foundation reuses a few words precisely. These are the ones newcomers most often
conflate — read this once and the package APIs read cleanly.

## The model

| Term | Meaning |
|---|---|
| **Observation** | The core record — "what was observed." The primary type in `@disclosureos/records`; every other layer builds on it. |
| **Layer** | One of the four model layers: **Records**, **Observables**, **Origins**, **Scoring**. Each answers one question. |
| **Slot** | A property the satellite layers add to `Observation` via module augmentation: `observableAssessments` (observables) and `origin` (origins). |
| **Portable contract** | The single enriched-`Observation` artifact (`@disclosureos/schema`) that means the same thing in TypeScript, JSON Schema, and other languages. `schema` is the contract, **not a fifth layer**. |

## Claims and who made them

| Term | Where | Meaning |
|---|---|---|
| **Attribution** | `records/shared` | The minimal who/when/why of a judgment: `evaluatedBy`, `evaluatedAt`, `rationale`. Reusable anywhere. |
| **Claim** | `records/shared` | `Attribution` **+ `evidenceRefs`** — an attributed judgment that can cite in-record evidence (`sensor:<id>`, `media:<id>`, …). The envelope every evaluative slot is built from. |
| **ObservableClaim** | `observables` | A `Claim` **+ a `level`** (`not_indicated` → … → `confirmed`), keyed under an observable id. The value of an `observableAssessments` entry is an **array** of these. |
| **Assessment** | `observables` | Informal name for an `ObservableClaim` (and the `observableAssessments` map as a whole). An assessment *is* a claim with a level. |
| **OriginClaim** | `origins` | A `Claim` **+ a `primaryHypothesis`** (an OCS node id) and optional `alternativeHypotheses`. The `origin` slot is an **array** of these. |

Why arrays? Multiple evaluators can assess the same observable or origin. Disagreement
is first-class (length-1 is the common case; a single verdict is never privileged).

## Confidence vs. credibility (three different axes)

| Term | Type | What it measures |
|---|---|---|
| **`confidence`** | number `[0, 1]` (`Confidence`) | How sure *one evaluator* is about *one claim*. Lives on `ObservableClaim` / `OriginClaim`. |
| **`ConfidenceLevel`** | enum (`very_low` … `very_high`) | Qualitative confidence on **records-domain investigation fields** (e.g. an investigation's overall confidence). Ordinal, not the numeric claim `confidence`. |
| **`SourceCredibility`** | records field | How trustworthy the **source/record itself** is (provenance, chain of custody) — independent of any evaluator's `confidence` in a claim. |

A record can have a credible source (`SourceCredibility`) carrying a claim that an
evaluator holds at low `confidence`. They are orthogonal — don't collapse them.

## Disagreement: two distinct kinds

| Term | Where | Kind of disagreement |
|---|---|---|
| **`alternativeHypotheses`** | `origins` (on one `OriginClaim`) | **Intra-claim** — *one evaluator* hedges across several origin nodes. |
| **`contested`** | `scoring` (computed) | **Inter-claim** — *different evaluators* point in opposing directions. Set by `score()` only when claims disagree on direction (not merely magnitude). |

So a single claim with `alternativeHypotheses` is **not** "contested"; `contested`
describes the *set* of claims for a slot.

## Validation entry points

| Function | Package | Scope |
|---|---|---|
| **`validateObservation`** | `records` | Core record only. Ignores (does not reject) the satellite slots. |
| **`validateObservableAssessments`** / **`validateOriginClassification`** | observables / origins | One slot's value. |
| **`parseEnrichedObservation`** | `schema` | The canonical check: core **+ every registered slot**, **without stripping**, and rejects unknown top-level keys. Use this for enriched records. |

> ⚠️ **Strip hazard.** A raw `ObservationSchema.parse(record)` silently **drops** the
> satellite slots (Zod strips unknown keys). Never use a raw `.parse()` round-trip to
> "clean" an enriched record — use `parseEnrichedObservation` (or `validateObservation`
> for core-only checks, which returns issues without mutating your object).
