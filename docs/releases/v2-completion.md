# Coordinated V2 beta release policy

Updated 2026-10-19. Beta 4 is published for all seven foundation packages, and the
portal consumes it. The original consolidated V2 implementation milestone is
complete. [Beta 4's release record](2.0.0-beta.4.md) retains its implementation
scope and historical preparation checklist.

## Next milestone: initial data integrations

Prepare Beta 5 after the agreed ELDÆON, Speculor and Sky360 integration checkpoints
are complete and their findings have been reviewed together. See the
[scope and acceptance criteria](beta5-integrations.md). This is a bounded
integration release, not a requirement to obtain every future provider file or
finish every possible instrument format.

- Continue implementation, conformance checks, source-based previews and review.
- Accumulate changesets without advancing package versions at each checkpoint.
- Reviewed changes may merge when authorized; merge does not publish packages.
- Keep npm publication on hold until the integration milestone and coordinated
  release review are complete, followed by explicit publication approval.
- Keep public portal dependencies on published Beta 4. Label proposed additions,
  such as MCAP source references, separately from published package capabilities.
- Provider reuse permission and protected/public delivery are separate decisions
  from accepting a source change or publishing the standard.

At closeout, review the changesets, prepare one coordinated package version and
run package, conformance, isolated-consumer and portal checks. Preserve published
schema identities and verify the exact release artifacts before publication.
Then verify the registry release and update portal dependencies and availability
language in a separate deployment.

Stable V2 remains a separate decision with its own acceptance gates. Completing
an integration or a beta release does not establish scientific validity,
calibration, provider endorsement or certification.
