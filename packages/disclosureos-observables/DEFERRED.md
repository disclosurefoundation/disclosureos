# Deferred Items — @disclosureos/observables

Low-priority items identified during v1 review. These are intentional design decisions
that are acceptable for v1 but should be reconsidered as the ecosystem matures.

---

## 9. Constants array naming: `_IDS` suffix

**Issue**: Observables uses `TECHNOLOGY_OBSERVABLE_IDS` (with `_IDS` suffix) while
Records uses bare plurals like `SOURCE_TYPES`, `MEDIA_TYPES`.

**Decision**: Keep as-is. The `_IDS` suffix is necessary in Observables because
without it, `TECHNOLOGY_OBSERVABLES` (the full definition records) and the ID-only
array would be ambiguous. Records doesn't have this disambiguation need since its
constants are always simple string arrays of the type values themselves.

---

## 10. `createEnumGuard` duplicated across packages — RESOLVED

**Issue (historical)**: `@disclosureos/records` and `@disclosureos/observables` each
defined an identical `createEnumGuard` helper.

**Resolution (Phase 1+)**: Obsolete. The zero-peer-dependency constraint was replaced
by the records-as-substrate model — `observables`/`origins`/`scoring` type-depend on
`@disclosureos/records`. `createEnumGuard` is now sourced once from
`@disclosureos/records/shared` and imported by satellites (`src/guards/index.ts`), so
there is no duplication. (`makeGuard` stays records-internal by design — the documented
cross-package Zod version-brand workaround.)
