import {
  parseVocabularyBindings,
  parseVocabularyCatalog,
  VOCABULARY_CATALOG_SCHEMA_ID,
  parseExperimentalClaimHistory,
  parseContextClaimHistory,
  parseResearchClaimHistory,
  parseArchivalClaimHistory,
  parseLaboratoryClaimHistory,
  parseCaseClaimHistory,
  EXPERIMENTAL_CLAIM_HISTORY_SCHEMA_ID,
  CONTEXT_CLAIM_HISTORY_SCHEMA_ID,
  RESEARCH_CLAIM_HISTORY_SCHEMA_ID,
  ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID,
  LABORATORY_CLAIM_HISTORY_SCHEMA_ID,
  CASE_CLAIM_HISTORY_SCHEMA_ID,
  compareUtcInstants,
  type VocabularyBindings,
  type VocabularyBinding,
  type VocabularyCatalog,
  type VocabularyCatalogTerm,
  type VocabularyTermReference,
  type VocabularyIssue,
  type DocumentSnapshotRef,
} from "@disclosureos/records/experimental/v2";
import { evaluateContextClaimHistory } from "./context-review";
import { evaluateResearchClaimHistory } from "./research-entities-review";
import { evaluateArchivalClaimHistory } from "./archival-review";
import { evaluateLaboratoryClaimHistory } from "./laboratory-review";
import { evaluateCaseClaimHistory } from "./case-history-review";

export const VOCABULARY_BINDINGS_PROFILE =
  "urn:disclosureos:profile:vocabulary-reference-resolution:0.1.0";
type Status = "passed" | "failed" | "not_checked";
export interface VocabularyBindingOptions {
  /** Exact UTF-8 document bytes keyed by their declared SHA-256. Never fetched. */
  documents: ReadonlyMap<string, Uint8Array>;
  /** Other selected companion documents participating in cardinality and continuity checks. */
  additionalBindings?: readonly unknown[];
}
export interface VocabularyResolutionIssue extends VocabularyIssue {
  status: "failed" | "not_checked";
}
export interface VocabularyBindingResolution {
  bindingsId: string;
  bindingId: string;
  relation: VocabularyBinding["relation"];
  claim: VocabularyBinding["claim"];
  term: VocabularyTermReference;
  status: Status;
  resolvedTerm?: VocabularyCatalogTerm;
}
export interface VocabularyBindingResult {
  success: boolean;
  profile: typeof VOCABULARY_BINDINGS_PROFILE;
  checks: {
    structural: "passed" | "failed";
    semantic: Status;
    profile: Status;
    external: "not_checked";
  };
  issues: VocabularyResolutionIssue[];
  unresolvedReferences: DocumentSnapshotRef[];
  snapshots: Array<DocumentSnapshotRef & { status: Status }>;
  bindings: VocabularyBindingResolution[];
  /** Extensions are retained, but this core evaluator does not approve domain semantics. */
  domainProfiles: "not_checked";
  scientificValidity: "not_checked";
  authenticity: "not_checked";
}
const key = (r: DocumentSnapshotRef) =>
  JSON.stringify([r.schemaId, r.documentId, r.sha256]);
const termKey = (t: VocabularyTermReference) =>
  JSON.stringify([t.catalogId, t.revision, key(t.document), t.termId]);
const claimKey = (b: VocabularyBinding) =>
  JSON.stringify([key(b.claim.document), b.claim.claimId]);
const digest = async (bytes: Uint8Array) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");

/** Decode strictly and reject duplicate keys, including escaped equivalents. */
function decode(bytes: Uint8Array): unknown {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const parsed: unknown = JSON.parse(text); // Establish grammar before walking token boundaries.
  let index = 0;
  const ws = () => {
    while (/\s/.test(text[index] ?? "") && index < text.length) index++;
  };
  function string(): string {
    const start = index++;
    while (index < text.length) {
      if (text[index++] === '"') break;
      if (text[index - 1] === "\\") index++;
    }
    return JSON.parse(text.slice(start, index)) as string;
  }
  function value() {
    ws();
    if (text[index] === '"') {
      string();
      return;
    }
    if (text[index] === "{") {
      index++;
      ws();
      const keys = new Set<string>();
      if (text[index] !== "}")
        for (;;) {
          ws();
          const name = string();
          if (keys.has(name)) throw new Error("Duplicate JSON object key.");
          keys.add(name);
          ws();
          index++;
          value();
          ws();
          if (text[index] !== ",") break;
          index++;
        }
      index++;
      return;
    }
    if (text[index] === "[") {
      index++;
      ws();
      if (text[index] !== "]")
        for (;;) {
          value();
          ws();
          if (text[index] !== ",") break;
          index++;
        }
      index++;
      return;
    }
    while (index < text.length && !/[\s,}\]]/.test(text[index]!)) index++;
  }
  value();
  return parsed;
}
type Claim = {
  id: string;
  kind: "source_assertion" | "assessment";
  recordedAt: string;
  status?: string | undefined;
  evaluatedBy?: string | undefined;
  supersedes?: string[] | undefined;
};
type History = { id: string; claims: Claim[] };
const histories = {
  [EXPERIMENTAL_CLAIM_HISTORY_SCHEMA_ID]: parseExperimentalClaimHistory,
  [CONTEXT_CLAIM_HISTORY_SCHEMA_ID]: parseContextClaimHistory,
  [RESEARCH_CLAIM_HISTORY_SCHEMA_ID]: parseResearchClaimHistory,
  [ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID]: parseArchivalClaimHistory,
  [LABORATORY_CLAIM_HISTORY_SCHEMA_ID]: parseLaboratoryClaimHistory,
  [CASE_CLAIM_HISTORY_SCHEMA_ID]: parseCaseClaimHistory,
};
const reviews = {
  [CONTEXT_CLAIM_HISTORY_SCHEMA_ID]: evaluateContextClaimHistory,
  [RESEARCH_CLAIM_HISTORY_SCHEMA_ID]: evaluateResearchClaimHistory,
  [ARCHIVAL_CLAIM_HISTORY_SCHEMA_ID]: evaluateArchivalClaimHistory,
  [LABORATORY_CLAIM_HISTORY_SCHEMA_ID]: evaluateLaboratoryClaimHistory,
  [CASE_CLAIM_HISTORY_SCHEMA_ID]: evaluateCaseClaimHistory,
};

/** Resolve declared terminology without changing subjects, inputs or assessment outcomes. */
export async function evaluateVocabularyBindings(
  input: unknown,
  options: VocabularyBindingOptions,
): Promise<VocabularyBindingResult> {
  // Copy every supplied dependency before the first await, including nested history dependencies.
  const documents = new Map(
    [...options.documents].map(([hash, bytes]) => [
      hash,
      Uint8Array.from(bytes),
    ]),
  );
  const parsed = [input, ...(options.additionalBindings ?? [])].map(
    parseVocabularyBindings,
  );
  const result: VocabularyBindingResult = {
    success: false,
    profile: VOCABULARY_BINDINGS_PROFILE,
    checks: {
      structural: "passed",
      semantic: "passed",
      profile: "not_checked",
      external: "not_checked",
    },
    issues: [],
    unresolvedReferences: [],
    snapshots: [],
    bindings: [],
    domainProfiles: "not_checked",
    scientificValidity: "not_checked",
    authenticity: "not_checked",
  };
  const problem = (
    code: string,
    pointer: string,
    message: string,
    status: "failed" | "not_checked" = "failed",
  ) => {
    result.issues.push({ code, pointer, message, stage: "profile", status });
  };
  const bindingsDocs: VocabularyBindings[] = [],
    seenDocs = new Map<string, string>();
  for (const [i, p] of parsed.entries()) {
    result.issues.push(
      ...p.issues.map((issue) => ({
        ...issue,
        pointer: `/documents/${i}${issue.pointer}`,
        status: "failed" as const,
      })),
    );
    if (p.checks.structural === "failed") result.checks.structural = "failed";
    if (p.checks.semantic === "failed") result.checks.semantic = "failed";
    if (!p.success) continue;
    const serialized = JSON.stringify(p.data),
      old = seenDocs.get(p.data.id);
    if (old && old !== serialized)
      problem(
        "VOCABULARY.BINDINGS_IDENTITY",
        `/documents/${i}/id`,
        "Selected companion documents reuse one ID with different contents.",
      );
    if (!old) bindingsDocs.push(p.data);
    seenDocs.set(p.data.id, serialized);
  }
  if (result.checks.structural === "failed")
    result.checks.semantic = "not_checked";
  if (parsed.some((p) => !p.success)) return result;
  const snapshots = new Map<string, DocumentSnapshotRef & { status: Status }>();
  const loaded = new Map<string, unknown>(),
    resolvedHistories = new Map<string, History>(),
    resolvedCatalogs = new Map<string, VocabularyCatalog>();
  const catalogRevisions = new Map<string, string>();
  function registerCatalog(
    catalog: VocabularyCatalog,
    ref: DocumentSnapshotRef,
    pointer: string,
  ) {
    const identity = JSON.stringify([catalog.catalogId, catalog.revision]),
      prior = catalogRevisions.get(identity);
    if (prior && prior !== key(ref))
      problem(
        "VOCABULARY.REVISION_CONFLICT",
        pointer,
        "One catalog revision identifies different supplied snapshots.",
      );
    catalogRevisions.set(identity, key(ref));
  }
  // Even an unreferenced supplied catalog must not redefine a selected immutable revision.
  for (const [hash, bytes] of documents) {
    try {
      const raw = decode(bytes);
      if (
        typeof raw === "object" &&
        raw !== null &&
        "kind" in raw &&
        raw.kind === "vocabulary_catalog"
      ) {
        const catalog = parseVocabularyCatalog(raw);
        if (catalog.success)
          registerCatalog(
            catalog.data,
            {
              documentId: catalog.data.id,
              schemaId: VOCABULARY_CATALOG_SCHEMA_ID,
              sha256: await digest(bytes),
            },
            `/documents/${hash}`,
          );
      }
    } catch {
      /* Referenced invalid bytes are diagnosed by load below. */
    }
  }
  async function load(
    ref: DocumentSnapshotRef,
    pointer: string,
  ): Promise<unknown> {
    const k = key(ref);
    if (snapshots.has(k)) return loaded.get(k);
    const snapshot = { ...ref, status: "not_checked" as Status };
    snapshots.set(k, snapshot);
    const bytes = documents.get(ref.sha256);
    if (!bytes) {
      problem(
        "SNAPSHOT.UNAVAILABLE",
        pointer,
        "Required snapshot bytes were not supplied.",
        "not_checked",
      );
      result.unresolvedReferences.push(ref);
      return;
    }
    snapshot.status = "failed";
    if ((await digest(bytes)) !== ref.sha256) {
      problem(
        "SNAPSHOT.DIGEST",
        pointer,
        "Supplied bytes differ from the declared SHA-256.",
      );
      return;
    }
    try {
      const data = decode(bytes);
      if (
        typeof data !== "object" ||
        data === null ||
        !("id" in data) ||
        data.id !== ref.documentId
      ) {
        problem(
          "SNAPSHOT.IDENTITY",
          pointer,
          "Document ID differs from the declared snapshot.",
        );
        return;
      }
      loaded.set(k, data);
      return data;
    } catch {
      problem(
        "SNAPSHOT.JSON",
        pointer,
        "Snapshot must be valid UTF-8 JSON without duplicate object keys.",
      );
    }
  }
  async function catalog(ref: VocabularyTermReference, pointer: string) {
    const k = key(ref.document);
    if (
      Object.prototype.hasOwnProperty.call(histories, ref.document.schemaId)
    ) {
      problem(
        "SNAPSHOT.CONTRACT",
        pointer,
        "A history contract cannot identify a vocabulary catalog.",
      );
      return;
    }
    if (!snapshots.has(k)) {
      const raw = await load(ref.document, pointer);
      if (raw !== undefined) {
        const snapshot = snapshots.get(k)!;
        if (ref.document.schemaId !== VOCABULARY_CATALOG_SCHEMA_ID) {
          if (
            Object.prototype.hasOwnProperty.call(
              histories,
              ref.document.schemaId,
            )
          )
            problem(
              "SNAPSHOT.CONTRACT",
              pointer,
              "A history contract cannot identify a vocabulary catalog.",
            );
          else {
            snapshot.status = "not_checked";
            problem(
              "SNAPSHOT.UNSUPPORTED",
              pointer,
              "The declared catalog contract is not supported.",
              "not_checked",
            );
            result.unresolvedReferences.push(ref.document);
          }
        } else {
          const p = parseVocabularyCatalog(raw);
          if (!p.success)
            problem(
              "SNAPSHOT.CONTRACT",
              pointer,
              "Catalog fails its declared contract or local semantics.",
            );
          else {
            snapshot.status = "passed";
            resolvedCatalogs.set(k, p.data);
            registerCatalog(p.data, ref.document, pointer);
          }
        }
      }
    }
    const data = resolvedCatalogs.get(k);
    if (!data) return;
    if (data.catalogId !== ref.catalogId || data.revision !== ref.revision) {
      problem(
        "VOCABULARY.IDENTITY",
        pointer,
        "Catalog identity or revision differs from the term reference.",
      );
      return;
    }
    const term = data.terms.find((t) => t.id === ref.termId);
    if (!term)
      problem(
        "VOCABULARY.TERM",
        pointer,
        "Term is absent from the supplied catalog revision.",
      );
    return term;
  }
  async function history(ref: DocumentSnapshotRef, pointer: string) {
    const k = key(ref);
    if (ref.schemaId === VOCABULARY_CATALOG_SCHEMA_ID) {
      problem(
        "SNAPSHOT.CONTRACT",
        pointer,
        "A vocabulary catalog contract cannot identify a claim history.",
      );
      return;
    }
    if (!snapshots.has(k)) {
      const raw = await load(ref, pointer);
      if (raw !== undefined) {
        const snapshot = snapshots.get(k)!,
          parser = Object.prototype.hasOwnProperty.call(histories, ref.schemaId)
            ? histories[ref.schemaId as keyof typeof histories]
            : undefined;
        if (!parser) {
          if (ref.schemaId === VOCABULARY_CATALOG_SCHEMA_ID)
            problem(
              "SNAPSHOT.CONTRACT",
              pointer,
              "A vocabulary catalog contract cannot identify a claim history.",
            );
          else {
            snapshot.status = "not_checked";
            problem(
              "SNAPSHOT.UNSUPPORTED",
              pointer,
              "The declared history contract is not supported.",
              "not_checked",
            );
            result.unresolvedReferences.push(ref);
          }
        } else {
          const p = parser(raw);
          if (!p.success)
            problem(
              "SNAPSHOT.CONTRACT",
              pointer,
              "History fails its declared contract or local semantics.",
            );
          else {
            snapshot.status = "passed";
            resolvedHistories.set(k, p.data);
            const review = Object.prototype.hasOwnProperty.call(
              reviews,
              ref.schemaId,
            )
              ? reviews[ref.schemaId as keyof typeof reviews]
              : undefined;
            if (review) {
              const reviewed = await review(p.data, { documents });
              for (const issue of reviewed.issues) {
                const unavailable = issue.code.endsWith(".UNAVAILABLE");
                problem(
                  issue.code,
                  pointer + issue.pointer,
                  issue.message,
                  unavailable ? "not_checked" : "failed",
                );
              }
              for (const item of reviewed.snapshots) {
                let status: Status =
                  item.status === "unavailable" ? "not_checked" : item.status;
                const dependentBytes = documents.get(item.sha256);
                if (dependentBytes)
                  try {
                    decode(dependentBytes);
                  } catch {
                    status = "failed";
                    problem(
                      "SNAPSHOT.JSON",
                      pointer,
                      "Dependent snapshot must be valid UTF-8 JSON without duplicate keys.",
                    );
                  }
                snapshots.set(key(item), {
                  documentId: item.documentId,
                  schemaId: item.schemaId,
                  sha256: item.sha256,
                  status,
                });
                if (status === "not_checked")
                  result.unresolvedReferences.push({
                    documentId: item.documentId,
                    schemaId: item.schemaId,
                    sha256: item.sha256,
                  });
              }
              if (reviewed.issues.length)
                snapshot.status = reviewed.issues.some(
                  (i) => !i.code.endsWith(".UNAVAILABLE"),
                )
                  ? "failed"
                  : "not_checked";
              if (
                reviewed.snapshots.some(
                  (item) => snapshots.get(key(item))?.status === "failed",
                )
              )
                snapshot.status = "failed";
            }
          }
        }
      }
    }
    return resolvedHistories.get(k);
  }
  type Entry = {
    binding: VocabularyBinding;
    resolution: VocabularyBindingResolution;
    pointer: string;
  };
  const entries: Entry[] = [];
  for (const [di, doc] of bindingsDocs.entries())
    for (const [bi, binding] of doc.bindings.entries()) {
      const pointer = `/documents/${di}/bindings/${bi}`,
        start = result.issues.length;
      const resolution: VocabularyBindingResolution = {
        bindingsId: doc.id,
        bindingId: binding.id,
        relation: binding.relation,
        claim: binding.claim,
        term: binding.term,
        status: "not_checked",
      };
      result.bindings.push(resolution);
      entries.push({ binding, resolution, pointer });
      const term = await catalog(binding.term, `${pointer}/term`),
        owner = await history(
          binding.claim.document,
          `${pointer}/claim/document`,
        );
      if (term) resolution.resolvedTerm = term;
      if (owner) {
        const claim = owner.claims.find((c) => c.id === binding.claim.claimId);
        if (!claim)
          problem(
            "VOCABULARY.CLAIM",
            `${pointer}/claim/claimId`,
            "Claim is absent from the referenced history snapshot.",
          );
        else {
          if (compareUtcInstants(binding.recordedAt, claim.recordedAt) === -1)
            problem(
              "VOCABULARY.CHRONOLOGY",
              `${pointer}/recordedAt`,
              "Binding cannot precede the target claim's recorded time.",
            );
          if (binding.relation === "assessment_criterion") {
            if (claim.kind !== "assessment" || claim.status !== "assessed")
              problem(
                "VOCABULARY.CRITERION_TARGET",
                pointer,
                "A criterion declaration requires an assessed claim.",
              );
            else if (binding.assignedBy !== claim.evaluatedBy)
              problem(
                "VOCABULARY.CRITERION_ATTRIBUTION",
                `${pointer}/assignedBy`,
                "Only the declared assessor can declare the assessment criterion.",
              );
          }
        }
      }
      const statuses = [
        snapshots.get(key(binding.term.document))?.status,
        snapshots.get(key(binding.claim.document))?.status,
      ];
      const issues = result.issues.slice(start);
      resolution.status =
        statuses.includes("failed") || issues.some((i) => i.status === "failed")
          ? "failed"
          : !term ||
              !owner ||
              statuses.includes("not_checked") ||
              issues.some((i) => i.status === "not_checked")
            ? "not_checked"
            : "passed";
    }
  const criteria = new Map<string, Entry[]>();
  for (const entry of entries.filter(
    (e) => e.binding.relation === "assessment_criterion",
  )) {
    const k = claimKey(entry.binding),
      list = criteria.get(k) ?? [];
    list.push(entry);
    criteria.set(k, list);
  }
  for (const list of criteria.values())
    if (new Set(list.map((e) => termKey(e.binding.term))).size > 1) {
      for (const e of list) e.resolution.status = "failed";
      problem(
        "VOCABULARY.CRITERION_CONFLICT",
        list[0]!.pointer,
        "An exact claim has more than one distinct declared criterion.",
      );
    }
  // Follow both directions from a declared assessed criterion; do not impose criteria on unrelated generic claims.
  for (const [historyKey, owner] of resolvedHistories) {
    const assessed = new Map(
      owner.claims
        .filter((c) => c.kind === "assessment" && c.status === "assessed")
        .map((c) => [c.id, c]),
    );
    const touched = new Set(
      entries
        .filter(
          (e) =>
            key(e.binding.claim.document) === historyKey &&
            e.binding.relation === "assessment_criterion",
        )
        .map((e) => e.binding.claim.claimId),
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const c of assessed.values())
        for (const prior of c.supersedes ?? []) {
          const id = prior.slice("claim:".length);
          if (assessed.has(id) && (touched.has(c.id) || touched.has(id))) {
            if (!touched.has(c.id) || !touched.has(id)) changed = true;
            touched.add(c.id);
            touched.add(id);
          }
        }
    }
    for (const c of assessed.values())
      if (touched.has(c.id))
        for (const prior of c.supersedes ?? []) {
          const id = prior.slice("claim:".length);
          if (!assessed.has(id)) continue;
          const current =
              criteria.get(JSON.stringify([historyKey, c.id])) ?? [],
            previous = criteria.get(JSON.stringify([historyKey, id])) ?? [];
          const all = [...current, ...previous];
          if (
            !current.length ||
            !previous.length ||
            all.some((e) => !e.resolution.resolvedTerm)
          ) {
            problem(
              "VOCABULARY.CRITERION_UNAVAILABLE",
              `/claims/${c.id}/supersedes`,
              "Both assessed revisions need a resolved criterion declaration in this exact history snapshot.",
              "not_checked",
            );
            for (const e of all)
              if (e.resolution.status !== "failed")
                e.resolution.status = "not_checked";
          } else if (
            termKey(current[0]!.binding.term) !==
            termKey(previous[0]!.binding.term)
          ) {
            problem(
              "VOCABULARY.CRITERION_CHANGED",
              `/claims/${c.id}/supersedes`,
              "An assessed revision cannot change its declared criterion. Use a separate assessment.",
            );
            all.forEach((e) => {
              e.resolution.status = "failed";
            });
          }
        }
  }
  result.snapshots = [...snapshots.values()];
  result.unresolvedReferences = [
    ...new Map(result.unresolvedReferences.map((r) => [key(r), r])).values(),
  ];
  result.checks.profile =
    result.issues.some((i) => i.status === "failed") ||
    result.bindings.some((b) => b.status === "failed")
      ? "failed"
      : result.issues.some((i) => i.status === "not_checked") ||
          result.bindings.some((b) => b.status === "not_checked")
        ? "not_checked"
        : "passed";
  result.success =
    result.checks.structural === "passed" &&
    result.checks.semantic === "passed" &&
    result.checks.profile === "passed";
  return result;
}
