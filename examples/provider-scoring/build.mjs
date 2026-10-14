import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { computeWorksheet } from "./methods/compute.mjs";

const root = fileURLToPath(new URL("./", import.meta.url));
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function save(file, value) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), json(value));
}
async function pin(ref, title, mediaType = "application/json") {
  const bytes = await readFile(path.join(root, ref));
  return { ref: ref.replaceAll("/", "-"), title, mediaType, sha256: sha256(bytes), byteLength: bytes.length };
}
const review = {
  id: "example-documentation-review", version: "1.0.0", title: "Example documentation review",
  question: "How well is this sample record documented for independent review?",
  rule: "Sum each criterion weight multiplied by its reviewer-assigned rating. Ratings are 0 (insufficient), 0.5 (partial), or 1 (adequate for this review). A missing rating withholds the whole score. No weights are redistributed.",
  criteria: [
    { id: "source-traceability", label: "Source traceability", weight: 25, description: "Can the reviewer locate the exact source versions used by this review?" },
    { id: "specimen-identity", label: "Specimen identity", weight: 25, description: "Does the supplied record distinguish the parent, prepared portions and tested specimen?" },
    { id: "method-detail", label: "Method detail", weight: 30, description: "Do the source descriptions explain the collection, preparation and analytical steps in enough detail for the intended independent review?" },
    { id: "stated-limits", label: "Stated limits", weight: 20, description: "Do the sources identify missing information and limits on interpretation?" },
  ],
  grades: [
    { id: "d", label: "D · Substantial gaps", min: 0, max: 50 },
    { id: "c", label: "C · Partial documentation", min: 50, max: 75 },
    { id: "b", label: "B · Substantial documentation", min: 75, max: 90 },
    { id: "a", label: "A · Extensive documentation", min: 90, max: 100 },
  ],
};
const priority = {
  id: "example-follow-up-priority", version: "1.0.0", title: "Example follow-up priority",
  question: "How urgent is follow-up documentation for this sample record?",
  rule: "Sum each criterion weight multiplied by its reviewer-assigned rating. Ratings are 0 (low priority), 0.5 (medium priority), or 1 (high priority). A missing rating withholds the whole score. No weights are redistributed.",
  criteria: [
    { id: "documentation-gaps", label: "Documentation gaps", weight: 50, description: "How much do gaps in the available method record limit further review?" },
    { id: "follow-up-value", label: "Value of follow-up", weight: 30, description: "How useful would a more complete procedure and uncertainty account be?" },
    { id: "version-preservation", label: "Version preservation", weight: 20, description: "How important is it to preserve exact source versions while follow-up proceeds?" },
  ],
  grades: [
    { id: "routine", label: "Routine", min: 0, max: 50 },
    { id: "soon", label: "Review soon", min: 50, max: 80 },
    { id: "priority", label: "Priority review", min: 80, max: 100 },
  ],
};
await save("methods/review.json", review);
await save("methods/priority.json", priority);
const baseCriteria = [
  { id: "source-traceability", rating: 1, rationale: "The reviewed observation identifies these source digests, and this example retains the selected source bytes. This does not authenticate the original sources." },
  { id: "specimen-identity", rating: 1, rationale: "The collection sheet and preparation protocol distinguish M-014, portions A and B, and analytical portion A1. The laboratory report assigns the copper result to A1." },
  { id: "method-detail", rating: 0.5, rationale: "The source explains collection, splitting, subsampling and partial extraction, and retains three readings. I count this as partial documentation even though the full analytical procedure and uncertainty budget are missing." },
  { id: "stated-limits", rating: 1, rationale: "The sources identify the unrecorded collection time, nominal masses, separate blank matrix, missing uncertainty budget and lack of a demonstrated link to the light." },
];
const worksheet = (id, method, criteria) => ({ id, fictional: true, methodId: method.id, methodVersion: method.version, scope: "Review of the seven retained files in this example, not every source linked by the wider case record.", criteria });
const teamA = worksheet("team-a-review", review, baseCriteria);
const teamB = worksheet("team-b-review", review, baseCriteria.map((criterion) => criterion.id === "method-detail" ? {
  ...criterion, rating: 0, rationale: "I rate the method detail as insufficient for this independent review. The narrative names a partial extraction but omits the operating procedure, recovery study and uncertainty budget needed to reconstruct the reported analysis.",
} : criterion));
const incomplete = worksheet("team-b-incomplete-review", review, baseCriteria.map((criterion) => criterion.id === "method-detail" ? {
  ...criterion, rating: null, rationale: "The reviewer has not yet recorded a judgment on method detail. This is missing review input, not an assessment of zero points.",
} : criterion));
const prioritySheet = worksheet("team-b-priority-review", priority, [
  { id: "documentation-gaps", rating: 0.5, rationale: "The sources document specimen identity and broad preparation steps, but omit a complete analytical procedure and uncertainty budget. The team assigns medium priority to filling these gaps." },
  { id: "follow-up-value", rating: 1, rationale: "A detailed procedure and uncertainty account would let a future reviewer examine the reported concentration more closely." },
  { id: "version-preservation", rating: 1, rationale: "The team assigns high priority to retaining exact revisions while requesting additional documentation. This is a review priority, not a claim that files are at risk." },
]);
for (const [name, value] of Object.entries({ "team-a": teamA, "team-b": teamB, priority: prioritySheet, incomplete })) {
  await save(`worksheets/${name}.json`, value);
}
const inputFiles = [
  ["inputs/case.json", "Retained fictional case record", "application/json"],
  ["inputs/observation.json", "Retained material observation", "application/json"],
  ["inputs/collection-sheet.md", "Collection sheet", "text/markdown"],
  ["inputs/handling-log.md", "Handling and storage record", "text/markdown"],
  ["inputs/preparation-protocol.md", "Preparation protocol", "text/markdown"],
  ["inputs/laboratory-report.md", "Laboratory report", "text/markdown"],
  ["inputs/laboratory-replicates.csv", "Three retained copper readings", "text/csv"],
];
const inputs = await Promise.all(inputFiles.map(([ref, title, mediaType]) => pin(ref, title, mediaType)));
const commonLimitations = [
  "The providers, judgments and source material are fictional. No physical collection or laboratory work occurred.",
  "The score describes this selected documentation review; it does not establish source authenticity, laboratory validity or anomalous behavior.",
  "The method uses authored reviewer judgments. Recomputing the arithmetic does not independently justify those judgments.",
  "Only the seven retained files form this scoring input scope. Other files referenced by the wider record have not been reviewed here.",
];
const policies = {};
for (const [name, method] of Object.entries({ review, priority })) {
  const criteriaPin = await pin(`methods/${name}.json`, method.title);
  const computationPin = await pin("methods/compute.mjs", "Example weighted-criteria calculation", "text/javascript");
  const artifacts = [
    { ...criteriaPin, id: method.id, version: method.version },
    { ...computationPin, id: "example-weighted-criteria-calculation", version: "1.0.0" },
  ].map(({ title, ...artifact }) => artifact);
  const policy = {
    kind: "provider_score_policy", schemaVersion: "0.1.0", id: method.id, version: method.version, title: method.title,
    metric: { id: name === "review" ? "documentation-review" : "follow-up-priority", label: name === "review" ? "Documentation for independent review" : "Follow-up priority", question: method.question },
    subjectKinds: ["record"],
    method: { description: method.rule, artifacts },
    applicability: "Applies to the named material observation and the exact seven-file review scope retained in this fictional example.",
    missingData: { handling: "withhold", description: "Withhold the whole score when any required criterion judgment is missing. Do not substitute zero or redistribute its weight." },
    limitations: commonLimitations,
    scale: { kind: "numeric", min: 0, max: 100, direction: "higher", unit: "points", grades: method.grades },
  };
  await save(`generated/policy-${name}.json`, policy);
  policies[name] = { value: policy, pin: await pin(`generated/policy-${name}.json`, method.title) };
}
const specifications = [
  { name: "team-a", provider: "a", method: review, policy: "review", worksheet: teamA },
  { name: "team-b", provider: "b", method: review, policy: "review", worksheet: teamB },
  { name: "priority", provider: "b", method: priority, policy: "priority", worksheet: prioritySheet },
  { name: "incomplete", provider: "b", method: review, policy: "review", worksheet: incomplete },
];
const results = [];
for (const spec of specifications) {
  const computed = computeWorksheet(spec.method, spec.worksheet);
  const policy = policies[spec.policy];
  const result = {
    kind: "provider_score_result", schemaVersion: "0.1.0", id: `example-provider-score-${spec.name}`,
    provider: { id: `fictional-review-team-${spec.provider}`, name: `Review team ${spec.provider.toUpperCase()} (fictional)` },
    producedAt: "2026-10-13T12:00:00Z",
    policy: { id: policy.value.id, version: policy.value.version, sha256: policy.pin.sha256, byteLength: policy.pin.byteLength },
    subject: { kind: "record", id: "meridian-reviewed-specimens-v1" },
    inputScope: { id: "meridian-material-review-seven-files-v1", description: "The retained material observation, case membership record, collection sheet, handling log, preparation protocol, laboratory report and three copper readings." },
    inputs,
    derivation: [await pin(`worksheets/${spec.name}.json`, "Provider review worksheet")],
    applicability: { status: "applicable", reason: "The declared material record and selected documentation fall within this example method's scope." },
    missingInputs: computed.missing.map((id) => ({ ref: `criterion-${id}`, description: `The provider has not recorded the required ${id} judgment.` })),
    limitations: commonLimitations,
    outcome: computed.status === "scored" ? {
      status: "scored", value: computed.value, gradeId: computed.grade,
      explanation: spec.policy === "review" ? "Weighted sum of this provider's documented criterion judgments about the selected sources." : "Weighted sum of this provider's follow-up priorities. This answers a different question from documentation quality.",
    } : { status: "unavailable", reasonCode: "missing_inputs", explanation: "Method detail has not been reviewed. The method withholds the score until every required judgment is recorded." },
  };
  await save(`generated/${spec.name}.json`, result);
  results.push({ id: spec.name, result: `generated/${spec.name}.json`, policy: `generated/policy-${spec.policy}.json`, method: `methods/${spec.policy}.json`, worksheet: `worksheets/${spec.name}.json` });
}
const provenance = {
  fictional: true,
  origin: "Exact retained source bytes copied from disclosurefoundation/dashboard apps/disclosureos/public/examples/meridian on the codex/v2-scoring-standard branch at commit 50fd17e.",
  sourcePaths: {
    "inputs/case.json": "verification-v1/retained/case.json",
    "inputs/observation.json": "verification-v1/retained/observation.json",
    ...Object.fromEntries(inputFiles.slice(2).map(([ref]) => [ref, `specimens-r2/sources/${path.basename(ref)}`])),
  },
  newMaterial: "Review methods, provider worksheets and score results are authored for this provider-scoring example. They do not alter the retained source files or earlier verification receipts.",
};
await save("provenance.json", provenance);
const files = [...new Set([
  ...inputFiles.map(([ref]) => ref), "methods/compute.mjs", "methods/review.json", "methods/priority.json", "provenance.json",
  ...results.flatMap((result) => [result.result, result.policy, result.worksheet]),
])];
await save("manifest.json", {
  kind: "fictional_provider_scoring_example", version: "1.0.0", fictional: true,
  title: "DisclosureOS example case: provider scoring",
  subjectLabel: "Material record in the DisclosureOS example case",
  results,
  comparisons: [
    { id: "shared", left: "team-a", right: "team-b", title: "Same method, different judgments", description: "Both teams reviewed the same seven files under the same method. Their judgment about method detail differs." },
    { id: "different", left: "team-a", right: "priority", title: "Different methods", description: "One result describes documentation; the other sets a follow-up priority. A shared 0–100 scale does not make the scores interchangeable." },
    { id: "incomplete", left: "team-a", right: "incomplete", title: "An unfinished review", description: "A required judgment has not been recorded. The score remains unavailable rather than being treated as zero." },
  ],
  files: await Promise.all(files.map(async (file) => ({ file, ...await pin(file, file,
    file.endsWith(".md") ? "text/markdown" : file.endsWith(".csv") ? "text/csv" : file.endsWith(".mjs") ? "text/javascript" : "application/json") }))),
});
console.log("Recomputed four fictional provider results and pinned their source, policy and worksheet files.");
