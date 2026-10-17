// Example-specific arithmetic. This is not a universal DisclosureOS scoring rule.
// Reviewer judgments are authored inputs; this function does not derive them
// from the case, certify them, or rank providers by authority.
export function computeWorksheet(method, worksheet) {
  if (!Array.isArray(method.criteria) || !method.criteria.length ||
      method.criteria.some((criterion) => !Number.isFinite(criterion.weight) || criterion.weight <= 0) ||
      method.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) !== 100 ||
      new Set(method.criteria.map((criterion) => criterion.id)).size !== method.criteria.length) {
    throw new Error("The example method must have unique criteria totaling 100 points.");
  }
  if (worksheet.methodId !== method.id || worksheet.methodVersion !== method.version ||
      !Array.isArray(worksheet.criteria) || worksheet.criteria.length !== method.criteria.length ||
      new Set(worksheet.criteria.map((criterion) => criterion.id)).size !== method.criteria.length) {
    throw new Error("The worksheet must identify this method and contain each criterion once.");
  }
  const criteria = method.criteria.map((criterion) => {
    const entry = worksheet.criteria.find((item) => item.id === criterion.id);
    if (!entry || ![null, 0, 0.5, 1].includes(entry.rating) || typeof entry.rationale !== "string" || !entry.rationale.trim()) {
      throw new Error(`Invalid or unexplained rating: ${criterion.id}`);
    }
    return {
      id: criterion.id,
      label: criterion.label,
      weight: criterion.weight,
      rating: entry.rating,
      awarded: entry.rating === null ? null : criterion.weight * entry.rating,
      rationale: entry.rationale,
    };
  });
  const missing = criteria.filter((criterion) => criterion.rating === null).map((criterion) => criterion.id);
  if (missing.length) return { status: "unavailable", value: null, grade: null, missing, criteria };
  const value = criteria.reduce((sum, criterion) => sum + criterion.awarded, 0);
  const band = method.grades.find((entry, index) => value >= entry.min &&
    (value < entry.max || (index === method.grades.length - 1 && value === entry.max)));
  if (!band) throw new Error("The example method must supply a grade for this score.");
  return { status: "scored", value, grade: band.id, missing, criteria };
}
