# RFC 0005: Frozen instrument and dataset context

Status: proposed v2 contract. Owners: instruments and schema; separate datasets package decision deferred until schema boundary review.

Separate instrument identity, immutable manifest revision, deployment/session, calibration event, and data product. A product identifies the exact configuration active during acquisition. A later calibration MUST NOT retroactively replace acquisition-time context.

Dataset releases contain an inventory with stable product IDs, byte digests and algorithms, sizes, media/native formats, locators, access/license conditions, sessions, and processing lineage. Derived products identify their inputs and method/environment versions. A spectrum is not a substitute for raw IQ merely because both originate from one instrument. Retain native formats; the standard defines exchange metadata rather than bulk telemetry encoding.

Timing includes clock source, scale, synchronization method, precision, uncertainty, and whether a timestamp denotes acquisition start/end or another event. Products declare acquisition intervals independently of session membership. A convenience `in_window` label MUST NOT override contradictory timestamps. Point samples do not prove overlapping integration intervals.

Calibration declarations and independently reviewed calibration records are distinct. Unknown method or uncertainty is representable but cannot satisfy a profile that requires it. Uncertainty magnitudes are nonnegative; sampling rates and coverage factors are positive where applicable. Signed Doppler, signed coordinates, and signed pressure differences are not prohibited by a generic positivity check.

References MUST resolve unambiguously to a pinned revision. Old `org:sensor` references migrate as unresolved history unless source provenance establishes a revision. Offline resolution uses a supplied inventory; missing inputs are reported as not checked, hash mismatches fail, and ambiguous matches are errors. No implicit network retrieval or credential transfer is allowed during core validation.

The public ELDÆON July sample is useful adapter input but its same-session and simultaneous-data claims require reconciliation. A frozen partner pilot additionally needs file inventories, clock meanings, configuration/calibration history, processing details, and authorized access conditions. No external review, permission, or reproducibility result is assumed by this proposal.

## Experimental acquisition-history implementation

The [acquisition context contract](../experimental/acquisition-context.md) now implements explicit instrument/manifest/deployment/calibration bindings, raw-product capture references, and nominal temporal applicability checks. Dataset release/session composition, verified byte binding to observations, uncertainty-aware clock checks, and research-profile integration remain follow-up work.

The [acquisition binding bridge](../experimental/acquisition-bindings.md) adds explicit Observation source/raw-product mappings and verifies supplied product, manifest, and calibration-report bytes. Physical identity, artifact-content interpretation, measurement/channel mapping, and scientific eligibility remain unverified.

The experimental [dataset release profile](../experimental/dataset-release.md) now
composes pinned reproduction packets into explicit sessions. This initial reviewed-
packet collection does not yet cover direct raw/unassessed intake or native adapters.
