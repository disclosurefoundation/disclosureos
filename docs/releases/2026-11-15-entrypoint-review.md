# Beta 6 documentation and installation review

Reviewed on 15 November 2026 against the published `2.0.0-beta.6` packages.
This is a documentation checkpoint, not another package release.

## Corrections

- All seven package READMEs now give exact Beta 6 install commands and distinguish published experimental APIs from the earlier root APIs.
- Current contract guides identify published APIs instead of describing completed work as an unpublished candidate. Links connect the primitive, capture, review and public-presentation contracts without expanding their supported revisions.
- Source-checkout examples remain identified as such. The intake walkthrough also works with the installed CLI.
- Historical release records, schemas, package versions, fixture bytes and receipts are retained unchanged.

## Installation verification

Using Node.js 22.22.0 and a new temporary npm project:

- Ran the seven README install commands against the public registry. All installed `2.0.0-beta.6`; `beta` resolved to that release and `latest` still selected V1.
- Used no dependency overrides. The installed validator was Zod 4.6.6. The production dependency audit passed without advisories.
- Executed the first-record README example and its deliberate invalid-status variant. The results matched the documented passed/failed and unchecked states.
- Resolved the V2 entry points named by the READMEs, ran CLI help, and exercised installed-CLI intake creation, inspection and validation with disposable files.
- Checked relative links in the edited Markdown documents.

The corresponding portal review checks the human-readable guides, single-page
Markdown, full AI text and the short `llms.txt` index. Its retained Beta 4 examples
use an explicit Zod 4.6.6 override; new Beta 6 installations do not need one.

## Published README boundary

The README copies inside the already-published Beta 6 tarballs still contain
older Beta 4 and prerelease wording. This repository correction does not replace
those immutable artifacts or change npm tags. Use the current
[installation guide](https://os.disclosure.org/v2/docs/installation) and repository
READMEs; include these corrections in the next planned package release.

## Next checkpoint

Review the integrations comparison separately. Compare the data actually supplied
and mapped by each project, verification performed, permissions and remaining work.
Do not treat an absent field in a reviewed sample as an unsupported project capability.
