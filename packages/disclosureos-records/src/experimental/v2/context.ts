import {
  ObservationContextSchema,
  OBSERVATION_CONTEXT_SCHEMA_ID,
} from "./context-schema";
import type { ObservationContext, ContextEntity } from "./context-schema";
import { checkTime, comparePoints } from "./primitives";
import type { PrimitiveIssue, EventTimeValue } from "./primitives";

export interface ContextIssue {
  code: string;
  stage: "structural" | "semantic" | "external";
  pointer: string;
  message: string;
}
export interface ContextAssertion {
  id: string;
  content: {
    state: string;
    value?: unknown;
    provenance?: {
      sourceRef: string;
      sourceDigest?: { algorithm: "sha256"; value: string };
      locator?: { kind: string; startSeconds?: number; endSeconds?: number };
    };
  };
}
/** Internal-shaped view of a structurally checked entity; values remain typed in ContextEntity. */
export function contextAssertions(
  entity: ContextEntity,
): { field: string; assertion: ContextAssertion }[] {
  return Object.entries(entity.fields).flatMap(([field, assertions]) =>
    ((assertions ?? []) as ContextAssertion[]).map((assertion) => ({
      field,
      assertion,
    })),
  );
}
export function parseObservationContext(input: unknown) {
  const parsed = ObservationContextSchema.safeParse(input);
  const contract = {
    schemaId: OBSERVATION_CONTEXT_SCHEMA_ID,
    rulesetVersion: "0.1.0",
  } as const;
  const issues: ContextIssue[] = [];
  const error = (code: string, pointer: string, message: string) =>
    issues.push({ code, stage: "semantic", pointer, message });
  if (!parsed.success)
    return {
      success: false as const,
      contract,
      checks: {
        structural: "failed",
        semantic: "not_checked",
        profile: "not_checked",
        external: "not_checked",
      } as const,
      issues: parsed.error.issues.map((i) => ({
        code: "STRUCT.VALUE",
        stage: "structural" as const,
        pointer: "/" + i.path.join("/"),
        message: i.message,
      })),
      uncheckedRefs: [] as string[],
    };
  const data = parsed.data;
  const entities = new Map<string, ContextEntity>();
  const relativeGraph = new Map<string, Set<string>>();
  for (const [i, entity] of data.entities.entries()) {
    const key = `${entity.kind}:${entity.id}`;
    if (entities.has(key))
      error("REF.UNIQUE_ID", `/entities/${i}/id`, "Duplicate entity identity.");
    entities.set(key, entity);
    if (entity.kind === "temporal") relativeGraph.set(entity.id, new Set());
  }
  function time(value: EventTimeValue, path: string) {
    const found: PrimitiveIssue[] = [];
    checkTime(value, path, found);
    found.forEach((i) => error(i.code, i.pointer, i.message));
  }
  time(
    { kind: "instant", value: data.recordedAt, timeScale: "UTC" },
    "/recordedAt",
  );
  const unchecked = new Set([data.observationRef.sha256]);
  if (data.acquisitionRef) unchecked.add(data.acquisitionRef.sha256);
  for (const [i, entity] of data.entities.entries()) {
    const path = `/entities/${i}`;
    const assertions = contextAssertions(entity);
    const ids = new Set<string>();
    for (const { field, assertion } of assertions) {
      const p = `${path}/fields/${field}`;
      if (ids.has(assertion.id))
        error(
          "REF.UNIQUE_ID",
          p,
          "Assertion IDs must be unique across fields within an entity.",
        );
      ids.add(assertion.id);
      const { content } = assertion;
      const prov = content.provenance;
      if (prov) {
        unchecked.add(prov.sourceRef);
        if (
          prov.locator?.kind === "time_range" &&
          prov.locator.endSeconds! < prov.locator.startSeconds!
        )
          error("TIME.INTERVAL", p, "Source locator end precedes start.");
      }
      if (!("value" in content)) continue;
      if (field === "eventTime" || field === "observedAt")
        time(content.value as EventTimeValue, p);
      const linkKind = (
        {
          placeId: "place",
          platformId: "platform",
          temporalId: "temporal",
        } as Record<string, string>
      )[field];
      if (linkKind && !entities.has(`${linkKind}:${content.value}`))
        error(
          "REF.LOCAL_RESOLUTION",
          p,
          "Context entity reference does not resolve.",
        );
      if (field === "placeIds")
        for (const id of content.value as string[])
          if (!entities.has(`place:${id}`))
            error(
              "REF.LOCAL_RESOLUTION",
              p,
              "Place reference does not resolve.",
            );
      if (
        field === "proximity" &&
        !entities.has(
          `place:${(content.value as { targetPlaceId: string }).targetPlaceId}`,
        )
      )
        error(
          "REF.LOCAL_RESOLUTION",
          p,
          "Proximity target place does not resolve.",
        );
      if (field === "relativeDate") {
        const relative = content.value as {
          anchorTemporalId: string;
          relation: string;
          offset?: unknown;
        };
        if (!entities.has(`temporal:${relative.anchorTemporalId}`))
          error(
            "REF.LOCAL_RESOLUTION",
            p,
            "Relative date anchor does not resolve.",
          );
        relativeGraph.get(entity.id)?.add(relative.anchorTemporalId);
        if (relative.relation === "during" && relative.offset)
          error(
            "TIME.RELATIVE_OFFSET",
            p,
            "A during relation cannot carry an offset.",
          );
      }
      if (field === "calendarPeriod") {
        const period = content.value as {
          kind: string;
          startYear: number;
          endYear: number;
        };
        if (
          period.kind !== "quarter" &&
          period.endYear - period.startYear !==
            (period.kind === "decade" ? 9 : 99)
        )
          error(
            "TIME.CALENDAR_PERIOD",
            p,
            "Declared period must cover exactly ten or one hundred years.",
          );
      }
      if (field === "calendarRange") {
        type Endpoint = {
          kind: string;
          value?: string;
          year?: number;
          quarter?: number;
          startYear?: number;
          endYear?: number;
        };
        const range = content.value as {
          start: { value: Endpoint };
          end: { value: Endpoint };
        };
        for (const endpoint of [range.start.value, range.end.value]) {
          if (["year", "month", "date", "instant"].includes(endpoint.kind))
            time(endpoint as EventTimeValue, p);
          if (
            ["decade", "century"].includes(endpoint.kind) &&
            endpoint.endYear! - endpoint.startYear! !==
              (endpoint.kind === "decade" ? 9 : 99)
          )
            error(
              "TIME.CALENDAR_PERIOD",
              p,
              "Endpoint period has invalid width.",
            );
        }
        const a = range.start.value,
          b = range.end.value;
        if (a.kind === b.kind) {
          const reversed = ["year", "month", "date", "instant"].includes(a.kind)
            ? comparePoints(
                a as Exclude<EventTimeValue, { kind: "interval" }>,
                b as Exclude<EventTimeValue, { kind: "interval" }>,
              ) > 0
            : a.kind === "quarter"
              ? a.year! * 4 + a.quarter! > b.year! * 4 + b.quarter!
              : a.startYear! > b.startYear!;
          if (reversed)
            error("TIME.INTERVAL", p, "Calendar range end precedes start.");
        }
      }
      if (field === "localTime") {
        const clock = content.value as {
          timezone?: string;
          utcOffset?: string;
        };
        if (clock.timezone)
          try {
            new Intl.DateTimeFormat("en", { timeZone: clock.timezone });
          } catch {
            error(
              "TIME.TIMEZONE",
              p,
              "Unknown timezone; no offset has been inferred.",
            );
          }
        if (
          clock.utcOffset?.slice(1, 3) === "14" &&
          !clock.utcOffset.endsWith(":00")
        )
          error("TIME.OFFSET", p, "UTC offset must not exceed fourteen hours.");
      }
    }
    const selectedFields = new Set<string>();
    for (const selection of entity.selections ?? []) {
      const p = `${path}/selections`;
      if (selectedFields.has(selection.field))
        error(
          "SELECTION.DUPLICATE_FIELD",
          p,
          "One selection is allowed per field.",
        );
      selectedFields.add(selection.field);
      if (!selection.consideredAssertionIds.includes(selection.assertionId))
        error(
          "SELECTION.INPUTS",
          p,
          "Selected assertion must be a considered input.",
        );
      if (
        new Set(selection.consideredAssertionIds).size !==
        selection.consideredAssertionIds.length
      )
        error("REF.UNIQUE_ID", p, "Considered assertions are repeated.");
      for (const id of selection.consideredAssertionIds)
        if (
          !assertions.some(
            (a) => a.field === selection.field && a.assertion.id === id,
          )
        )
          error(
            "REF.FIELD_MISMATCH",
            p,
            "Considered assertion must exist on the selected field.",
          );
      const chosen = assertions.find(
        (a) =>
          a.field === selection.field &&
          a.assertion.id === selection.assertionId,
      );
      if (
        !chosen ||
        !["known", "approximate", "unmapped"].includes(
          chosen.assertion.content.state,
        )
      )
        error(
          "SELECTION.VALUE",
          p,
          "Select a sourced assertion, not an unknown or redacted value.",
        );
      time(
        { kind: "instant", value: selection.evaluatedAt, timeScale: "UTC" },
        p,
      );
      if (
        comparePoints(
          { kind: "instant", value: selection.evaluatedAt, timeScale: "UTC" },
          { kind: "instant", value: data.recordedAt, timeScale: "UTC" },
        ) > 0
      )
        error(
          "SELECTION.ORDER",
          p,
          "Selection evaluation cannot follow its recording.",
        );
      unchecked.add(selection.methodRef);
    }
    const measurements = new Set<string>();
    for (const link of entity.measurements ?? []) {
      if (measurements.has(link.id))
        error(
          "REF.UNIQUE_ID",
          `${path}/measurements`,
          "Measurement link IDs repeat.",
        );
      measurements.add(link.id);
      unchecked.add(`measurement:${link.measurementId}`);
      if (link.relatedPlaceId && !entities.has(`place:${link.relatedPlaceId}`))
        error(
          "REF.LOCAL_RESOLUTION",
          `${path}/measurements`,
          "Related place does not resolve.",
        );
    }
  }
  // Iterative cycle check avoids recursion proportional to user input size.
  const degree = new Map([...relativeGraph.keys()].map((k) => [k, 0]));
  for (const edges of relativeGraph.values())
    for (const to of edges)
      if (degree.has(to)) degree.set(to, degree.get(to)! + 1);
  const queue = [...degree].filter(([, n]) => n === 0).map(([key]) => key);
  for (let i = 0; i < queue.length; i++)
    for (const to of relativeGraph.get(queue[i]!) ?? [])
      if (degree.has(to)) {
        degree.set(to, degree.get(to)! - 1);
        if (degree.get(to) === 0) queue.push(to);
      }
  if (queue.length !== degree.size)
    error(
      "TIME.RELATIVE_CYCLE",
      "/entities",
      "Relative dates must be acyclic.",
    );
  const validation = {
    contract,
    issues,
    uncheckedRefs: [...unchecked],
    checks: {
      structural: "passed",
      semantic: issues.length ? "failed" : "passed",
      profile: "not_checked",
      external: "not_checked",
    } as const,
  };
  return issues.length
    ? { ...validation, success: false as const }
    : { ...validation, success: true as const, data };
}
