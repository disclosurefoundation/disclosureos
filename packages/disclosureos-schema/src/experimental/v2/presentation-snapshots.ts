import type { DocumentSnapshotRef } from "@disclosureos/records/experimental/v2";
const decode = (b: Uint8Array): unknown =>
  JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b));
/** Capture declared graph edges before awaiting. Callers must validate every used schema and identity. */
export function capturePresentationSnapshots(
  documents: ReadonlyMap<string, Uint8Array>,
  roots: DocumentSnapshotRef[],
) {
  const copies = new Map<string, Uint8Array>();
  const pending = [...roots];
  for (let i = 0; i < pending.length; i++) {
    const r = pending[i]!;
    if (copies.has(r.sha256)) continue;
    const b = documents.get(r.sha256);
    if (!b) throw Error("Missing snapshot");
    const captured = Uint8Array.from(b);
    copies.set(r.sha256, captured);
    const v = decode(captured) as {
      observationRef?: DocumentSnapshotRef;
      acquisitionRef?: DocumentSnapshotRef;
      contextRefs?: DocumentSnapshotRef[];
      entityRefs?: DocumentSnapshotRef[];
      observationRefs?: DocumentSnapshotRef[];
      caseRefs?: DocumentSnapshotRef[];
      links?: Array<{
        kind: string;
        document: DocumentSnapshotRef;
        reference: { document: DocumentSnapshotRef };
      }>;
    };
    pending.push(
      ...(v.observationRef ? [v.observationRef] : []),
      ...(v.acquisitionRef ? [v.acquisitionRef] : []),
      ...(v.contextRefs ?? []),
      ...(v.entityRefs ?? []),
      ...(v.observationRefs ?? []),
      ...(v.caseRefs ?? []),
    );
    for (const l of v.links ?? [])
      pending.push(l.kind === "intake" ? l.document : l.reference.document);
  }
  return copies;
}
