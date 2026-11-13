# Coordinated V2 beta release policy

**Release update, 2026-11-13:** Beta 5 is published and its registry bytes and
tags are verified. The earlier preparation holds below are historical. See the
[release record](2.0.0-beta.5.md) and its registry receipt. The portal update can
now use Beta 5; provider permissions and the documented scope boundaries remain
unchanged.

Updated 2026-11-10. Beta 4 is published for all seven foundation packages, and the
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
- The integration scope is closed; coordinated Beta 5 version preparation is now
  authorized. Merges and publication remain held during final verification.
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
