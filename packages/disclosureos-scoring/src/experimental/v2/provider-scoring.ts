import { z } from "zod";

const text = z.string().min(1).regex(/\S/);
const id = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*(?![\s\S])/);
const finite = z.number().finite();
const pin = z.strictObject({
  sha256: z.string().regex(/^[a-f0-9]{64}(?![\s\S])/),
  byteLength: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
});
const artifact = z.strictObject({
  ref: id,
  title: text,
  mediaType: text,
  ...pin.shape,
});
const subjectKind = z.enum([
  "case",
  "record",
  "claim",
  "measurement",
  "product",
  "source",
  "collection",
]);
const direction = z.enum(["higher", "lower", "none"]);
const grade = z.strictObject({ id, label: text, min: finite, max: finite });

export const PROVIDER_SCORE_POLICY_SCHEMA_ID =
  "urn:disclosureos:experimental:provider-score-policy:0.1.0";
export const PROVIDER_SCORE_RESULT_SCHEMA_ID =
  "urn:disclosureos:experimental:provider-score-result:0.1.0";

/** A provider-defined method, not a DisclosureOS universal case grade. */
export const ProviderScorePolicySchema = z.strictObject({
  kind: z.literal("provider_score_policy"),
  schemaVersion: z.literal("0.1.0"),
  id: text,
  version: text,
  title: text,
  metric: z.strictObject({ id: text, label: text, question: text }),
  subjectKinds: z.array(subjectKind).min(1),
  method: z.strictObject({
    description: text,
    artifacts: z
      .array(
        z.strictObject({
          ref: id,
          id: text,
          version: text,
          mediaType: text,
          ...pin.shape,
        })
      )
      .min(1),
  }),
  applicability: text,
  missingData: z.strictObject({
    handling: z.enum(["withhold", "allow_partial"]),
    description: text,
  }),
  limitations: z.array(text).min(1),
  scale: z.discriminatedUnion("kind", [
    z.strictObject({
      kind: z.literal("numeric"),
      min: finite,
      max: finite,
      direction,
      unit: text,
      grades: z.array(grade),
    }),
    z.strictObject({
      kind: z.literal("ordinal"),
      direction,
      levels: z
        .array(z.strictObject({ id, label: text, description: text }))
        .min(2),
    }),
  ]),
});
export type ProviderScorePolicy = z.infer<typeof ProviderScorePolicySchema>;

/** Common evidence inputs and the provider's derivation are deliberately separate. */
export const ProviderScoreResultSchema = z.strictObject({
  kind: z.literal("provider_score_result"),
  schemaVersion: z.literal("0.1.0"),
  id,
  provider: z.strictObject({
    id: text,
    name: text,
    url: z
      .url()
      .regex(/^https?:\/\//i)
      .optional(),
  }),
  producedAt: z.iso.datetime({ offset: true }),
  policy: z.strictObject({ id: text, version: text, ...pin.shape }),
  subject: z.strictObject({ kind: subjectKind, id: text }),
  inputScope: z.strictObject({ id: text, description: text }),
  inputs: z.array(artifact).min(1),
  derivation: z.array(artifact),
  applicability: z.strictObject({
    status: z.enum(["applicable", "not_applicable", "undetermined"]),
    reason: text,
  }),
  missingInputs: z.array(z.strictObject({ ref: id, description: text })),
  limitations: z.array(text),
  outcome: z.discriminatedUnion("status", [
    z.strictObject({
      status: z.literal("scored"),
      value: z.union([finite, id]),
      gradeId: id.optional(),
      explanation: text,
    }),
    z.strictObject({
      status: z.literal("unavailable"),
      reasonCode: z.enum([
        "missing_inputs",
        "not_applicable",
        "undetermined",
        "not_calculated",
      ]),
      explanation: text,
    }),
  ]),
});
export type ProviderScoreResult = z.infer<typeof ProviderScoreResultSchema>;

export function providerScorePolicyJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ProviderScorePolicySchema, { target: "draft-2020-12" }),
    $id: PROVIDER_SCORE_POLICY_SCHEMA_ID,
  };
}
export function providerScoreResultJsonSchema(): Record<string, unknown> {
  return {
    ...z.toJSONSchema(ProviderScoreResultSchema, { target: "draft-2020-12" }),
    $id: PROVIDER_SCORE_RESULT_SCHEMA_ID,
  };
}

type Status = "passed" | "failed" | "not_checked";
export interface ProviderScoringIssue {
  code: string;
  pointer: string;
  message: string;
}
function structuralIssues(error: z.ZodError): ProviderScoringIssue[] {
  return error.issues.map((issue) => ({
    code: "PROVIDER_SCORE.STRUCTURE",
    pointer:
      "/" +
      issue.path
        .map((p) => String(p).replace(/~/g, "~0").replace(/\//g, "~1"))
        .join("/"),
    message: issue.message,
  }));
}
function duplicateIssues(
  values: readonly string[],
  pointer: string,
  issues: ProviderScoringIssue[]
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value))
      issues.push({
        code: "PROVIDER_SCORE.DUPLICATE",
        pointer: `${pointer}/${index}`,
        message: "Identifiers must be unique within this list",
      });
    seen.add(value);
  });
}

export interface ProviderScorePolicyValidation {
  success: boolean;
  checks: { structural: Status; semantic: Status };
  issues: ProviderScoringIssue[];
  policy: ProviderScorePolicy | null;
}

/** JSON Schema covers structure; this checks bounds, identifiers and complete non-overlapping grade bands. */
export function validateProviderScorePolicy(
  input: unknown
): ProviderScorePolicyValidation {
  const parsed = ProviderScorePolicySchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      checks: { structural: "failed", semantic: "not_checked" },
      issues: structuralIssues(parsed.error),
      policy: null,
    };
  const policy = parsed.data;
  const issues: ProviderScoringIssue[] = [];
  duplicateIssues(policy.subjectKinds, "/subjectKinds", issues);
  duplicateIssues(
    policy.method.artifacts.map((a) => a.ref),
    "/method/artifacts",
    issues
  );
  if (policy.scale.kind === "numeric") {
    const scale = policy.scale;
    if (scale.min >= scale.max)
      issues.push({
        code: "PROVIDER_SCORE.SCALE",
        pointer: "/scale",
        message: "Numeric scale minimum must be less than its maximum",
      });
    duplicateIssues(
      scale.grades.map((g) => g.id),
      "/scale/grades",
      issues
    );
    scale.grades.forEach((band, index) => {
      const previous = scale.grades[index - 1];
      if (
        band.min >= band.max ||
        band.min < scale.min ||
        band.max > scale.max ||
        band.min !== (previous?.max ?? scale.min) ||
        (index === scale.grades.length - 1 && band.max !== scale.max)
      ) {
        issues.push({
          code: "PROVIDER_SCORE.GRADE_BANDS",
          pointer: `/scale/grades/${index}`,
          message:
            "Grade bands must be ordered, contiguous and cover the scale exactly; lower bounds are inclusive, upper bounds exclusive except the final maximum",
        });
      }
    });
  } else
    duplicateIssues(
      policy.scale.levels.map((level) => level.id),
      "/scale/levels",
      issues
    );
  return {
    success: issues.length === 0,
    checks: {
      structural: "passed",
      semantic: issues.length ? "failed" : "passed",
    },
    issues,
    policy: issues.length ? null : policy,
  };
}

/** Assign a provider's declared band, without recomputing or endorsing its score. */
export function providerScoreGrade(
  policy: ProviderScorePolicy,
  value: number | string
): { id: string; label: string } | null {
  if (!validateProviderScorePolicy(policy).success) return null;
  if (policy.scale.kind === "ordinal") {
    const level = policy.scale.levels.find((entry) => entry.id === value);
    return level ? { id: level.id, label: level.label } : null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const bands = policy.scale.grades;
  const band = bands.find(
    (entry, index) =>
      value >= entry.min &&
      (value < entry.max || (index === bands.length - 1 && value === entry.max))
  );
  return band ? { id: band.id, label: band.label } : null;
}

export interface ProviderScoreEvaluationOptions {
  policyBytes?: Uint8Array;
  inputFiles?: ReadonlyMap<string, Uint8Array>;
  derivationFiles?: ReadonlyMap<string, Uint8Array>;
  methodFiles?: ReadonlyMap<string, Uint8Array>;
}
export interface ProviderScoreEvaluation {
  success: boolean;
  checks: { structural: Status; semantic: Status; external: Status };
  issues: ProviderScoringIssue[];
  files: {
    ref: string;
    status: Status;
    expectedSha256: string;
    expectedByteLength: number;
    actualSha256?: string;
    actualByteLength?: number;
  }[];
  policy: ProviderScorePolicy | null;
  result: ProviderScoreResult | null;
  grade: { id: string; label: string } | null;
  policyExecution: "not_checked";
  providerAuthentication: "not_checked";
  scientificValidity: "not_checked";
  subjectResolution: "not_checked";
}
async function sha256(bytes: Uint8Array): Promise<string> {
  return [
    ...new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(bytes))
    ),
  ]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
function snapshot(files: ReadonlyMap<string, Uint8Array> | undefined) {
  return new Map(
    [...(files ?? [])].map(([ref, bytes]) => [ref, Uint8Array.from(bytes)])
  );
}

/** Checks declarations and supplied bytes only. Does not fetch, execute a policy, resolve a subject or authenticate a provider. */
export async function evaluateProviderScore(
  input: unknown,
  options: ProviderScoreEvaluationOptions = {}
): Promise<ProviderScoreEvaluation> {
  const evaluation: ProviderScoreEvaluation = {
    success: false,
    checks: {
      structural: "passed",
      semantic: "not_checked",
      external: "not_checked",
    },
    issues: [],
    files: [],
    policy: null,
    result: null,
    grade: null,
    policyExecution: "not_checked",
    providerAuthentication: "not_checked",
    scientificValidity: "not_checked",
    subjectResolution: "not_checked",
  };
  const parsed = ProviderScoreResultSchema.safeParse(input);
  if (!parsed.success) {
    evaluation.checks.structural = "failed";
    evaluation.issues = structuralIssues(parsed.error);
    return evaluation;
  }
  const result = parsed.data;
  evaluation.result = result;
  const policyBytes =
    options.policyBytes && Uint8Array.from(options.policyBytes);
  const inputFiles = snapshot(options.inputFiles),
    derivationFiles = snapshot(options.derivationFiles),
    methodFiles = snapshot(options.methodFiles);
  const issue = (code: string, pointer: string, message: string) =>
    evaluation.issues.push({
      code: `PROVIDER_SCORE.${code}`,
      pointer,
      message,
    });
  duplicateIssues(
    [...result.inputs, ...result.derivation, ...result.missingInputs].map(
      (entry) => entry.ref
    ),
    "/artifactRefs",
    evaluation.issues
  );
  async function checkFile(
    ref: string,
    declared: z.infer<typeof pin>,
    bytes: Uint8Array | undefined,
    pointer: string
  ) {
    const check: ProviderScoreEvaluation["files"][number] = {
      ref,
      status: "not_checked",
      expectedSha256: declared.sha256,
      expectedByteLength: declared.byteLength,
    };
    evaluation.files.push(check);
    if (!bytes) {
      issue("MISSING_FILE", pointer, "Declared bytes were not supplied");
      return false;
    }
    check.actualByteLength = bytes.byteLength;
    if (check.actualByteLength !== declared.byteLength) {
      check.status = "failed";
      issue(
        "PIN_MISMATCH",
        pointer,
        "Supplied bytes do not match the declared length"
      );
      return false;
    }
    try {
      check.actualSha256 = await sha256(bytes);
    } catch {
      issue(
        "HASH_UNAVAILABLE",
        pointer,
        "SHA-256 could not be computed in this environment"
      );
      return false;
    }
    check.status =
      check.actualByteLength === declared.byteLength &&
      check.actualSha256 === declared.sha256
        ? "passed"
        : "failed";
    if (check.status === "failed")
      issue(
        "PIN_MISMATCH",
        pointer,
        "Supplied bytes do not match the declared digest and length"
      );
    return check.status === "passed";
  }
  const policyMatches = await checkFile(
    "policy",
    result.policy,
    policyBytes,
    "/policy"
  );
  if (!policyMatches) {
    evaluation.checks.external = evaluation.files.some(
      (file) => file.status === "failed"
    )
      ? "failed"
      : "not_checked";
    if (
      evaluation.issues.some(
        (entry) => entry.code === "PROVIDER_SCORE.DUPLICATE"
      )
    )
      evaluation.checks.semantic = "failed";
    return evaluation;
  }
  let policyInput: unknown;
  try {
    const serialized = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(policyBytes);
    policyInput = JSON.parse(serialized);
  } catch {
    issue(
      "POLICY_JSON",
      "/policy",
      "Policy bytes must contain valid UTF-8 JSON without a byte-order mark"
    );
    evaluation.checks.structural = "failed";
    evaluation.checks.external = "passed";
    return evaluation;
  }
  const policyValidation = validateProviderScorePolicy(policyInput);
  if (!policyValidation.success || !policyValidation.policy) {
    evaluation.checks.structural = policyValidation.checks.structural;
    evaluation.checks.semantic = policyValidation.checks.semantic;
    evaluation.issues.push(
      ...policyValidation.issues.map((entry) => ({
        ...entry,
        pointer: `/policy${entry.pointer}`,
      }))
    );
    return evaluation;
  }
  const policy = policyValidation.policy;
  evaluation.policy = policy;
  if (
    policy.id !== result.policy.id ||
    policy.version !== result.policy.version
  )
    issue(
      "POLICY_IDENTITY",
      "/policy",
      "Policy identity and revision must match the pinned document"
    );
  if (!policy.subjectKinds.includes(result.subject.kind))
    issue(
      "SUBJECT_KIND",
      "/subject/kind",
      "The policy does not apply to this subject kind"
    );
  if (result.outcome.status === "scored") {
    if (result.applicability.status !== "applicable")
      issue(
        "APPLICABILITY",
        "/applicability",
        "A score requires an applicable policy"
      );
    if (
      result.missingInputs.length &&
      policy.missingData.handling === "withhold"
    )
      issue(
        "MISSING_INPUTS",
        "/missingInputs",
        "This policy withholds a score when required inputs are missing"
      );
    const value = result.outcome.value;
    if (policy.scale.kind === "numeric") {
      if (
        typeof value !== "number" ||
        value < policy.scale.min ||
        value > policy.scale.max
      )
        issue(
          "VALUE",
          "/outcome/value",
          "Value must be a finite number within the policy scale"
        );
    } else if (
      typeof value !== "string" ||
      !policy.scale.levels.some((entry) => entry.id === value)
    )
      issue(
        "VALUE",
        "/outcome/value",
        "Value must identify a declared ordinal level"
      );
    evaluation.grade = providerScoreGrade(policy, value);
    if (
      result.outcome.gradeId !== undefined &&
      result.outcome.gradeId !== evaluation.grade?.id
    )
      issue(
        "GRADE",
        "/outcome/gradeId",
        "Declared grade does not match the policy band or ordinal level"
      );
  } else {
    const reason = result.outcome.reasonCode;
    if (
      (reason === "missing_inputs" && !result.missingInputs.length) ||
      (reason === "not_applicable" &&
        result.applicability.status !== "not_applicable") ||
      (reason === "undetermined" &&
        result.applicability.status !== "undetermined")
    )
      issue(
        "UNAVAILABLE_REASON",
        "/outcome/reasonCode",
        "Unavailable reason must agree with the recorded applicability or missing inputs"
      );
    if (
      (result.applicability.status === "not_applicable" &&
        reason !== "not_applicable") ||
      (result.applicability.status === "undetermined" &&
        reason !== "undetermined")
    )
      issue(
        "UNAVAILABLE_REASON",
        "/outcome/reasonCode",
        "Unavailable reason must retain the policy applicability state"
      );
  }
  evaluation.checks.semantic = evaluation.issues.length ? "failed" : "passed";
  for (const [index, entry] of policy.method.artifacts.entries())
    await checkFile(
      `method:${entry.ref}`,
      entry,
      methodFiles.get(entry.ref),
      `/policy/method/artifacts/${index}`
    );
  for (const [index, entry] of result.inputs.entries())
    await checkFile(
      `input:${entry.ref}`,
      entry,
      inputFiles.get(entry.ref),
      `/inputs/${index}`
    );
  for (const [index, entry] of result.derivation.entries())
    await checkFile(
      `derivation:${entry.ref}`,
      entry,
      derivationFiles.get(entry.ref),
      `/derivation/${index}`
    );
  evaluation.checks.external = evaluation.files.some(
    (file) => file.status === "failed"
  )
    ? "failed"
    : evaluation.files.every((file) => file.status === "passed")
    ? "passed"
    : "not_checked";
  evaluation.success =
    evaluation.checks.semantic === "passed" &&
    evaluation.checks.external === "passed";
  return evaluation;
}

export interface ProviderScoreComparison {
  eligibleForComparison: boolean;
  status: "eligible_for_comparison" | "not_eligible";
  reasons: string[];
  left: ProviderScoreEvaluation;
  right: ProviderScoreEvaluation;
  sharedInputDigests: string[];
  statisticalIndependence: "not_checked";
}

/** Conservative eligibility for inspecting declared results side by side; never computes a winner, average or scientific equivalence. */
export async function compareProviderScores(
  leftInput: unknown,
  rightInput: unknown,
  options: {
    left?: ProviderScoreEvaluationOptions;
    right?: ProviderScoreEvaluationOptions;
  } = {}
): Promise<ProviderScoreComparison> {
  const [left, right] = await Promise.all([
    evaluateProviderScore(leftInput, options.left),
    evaluateProviderScore(rightInput, options.right),
  ]);
  const reasons: string[] = [];
  const a = left.result,
    b = right.result;
  if (!left.success || !right.success) reasons.push("unverified_result");
  if (a && b) {
    if (a.outcome.status !== "scored" || b.outcome.status !== "scored")
      reasons.push("unavailable_result");
    if (
      a.policy.id !== b.policy.id ||
      a.policy.version !== b.policy.version ||
      a.policy.sha256 !== b.policy.sha256 ||
      a.policy.byteLength !== b.policy.byteLength
    )
      reasons.push("different_policy");
    if (a.subject.id !== b.subject.id || a.subject.kind !== b.subject.kind)
      reasons.push("different_subject");
    if (
      a.inputScope.id !== b.inputScope.id ||
      a.inputScope.description !== b.inputScope.description
    )
      reasons.push("different_input_scope");
    const basis = (value: ProviderScoreResult) =>
      JSON.stringify(
        value.inputs
          .map((entry) => [
            entry.ref,
            entry.sha256,
            entry.byteLength,
            entry.mediaType,
          ])
          .sort((x, y) => String(x[0]).localeCompare(String(y[0])))
      );
    if (basis(a) !== basis(b)) reasons.push("different_inputs");
    if (a.missingInputs.length || b.missingInputs.length)
      reasons.push("incomplete_inputs");
  }
  const sharedInputDigests =
    a && b
      ? [
          ...new Set(
            a.inputs
              .map((entry) => entry.sha256)
              .filter((digest) =>
                b.inputs.some((entry) => entry.sha256 === digest)
              )
          ),
        ].sort()
      : [];
  return {
    eligibleForComparison: reasons.length === 0,
    status: reasons.length ? "not_eligible" : "eligible_for_comparison",
    reasons,
    left,
    right,
    sharedInputDigests,
    statisticalIndependence: "not_checked",
  };
}
