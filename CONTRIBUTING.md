# Contributing to DisclosureOS

Start with the [V2 documentation](https://os.disclosure.org/v2/docs) and the
[example viewer](https://os.disclosure.org/showcase). This repository maintains the
standard packages; portal changes belong in disclosurefoundation/dashboard.

## Propose a change

Open an issue describing the research or implementation problem, a minimal example
and the expected result. Identify the package version and relevant schema identity.
Use synthetic or openly licensed fixtures. Do not post private partner data,
credentials, exact sensitive locations or identifying witness information.

For contract changes, explain the distinction between source information,
measurements and attributed interpretation. Include units, reference frames,
uncertainty and missing-information behavior when relevant. Discuss a substantial
change in an issue or RFC before adding a new contract.

## Develop and verify

Use Node.js 22 and pnpm 9.15.0. Follow the root README to install and build. Run the
affected package tests and strict publish checks, regenerate affected JSON Schemas,
and add a focused conformance example for behavior changes. Pull requests should
explain the problem, resulting behavior and validation. Maintainers review contract
changes and release decisions; a merged PR does not authorize npm publication.

Existing published schema identities are immutable. A changed contract needs a new
identity and version, including when its path moves. Keep historical identifiers
and artifacts stable. The release checks compare published hashes as well as the
candidate's frozen baseline.

## Review boundaries

Engineering acceptance checks document structure and declared relationships. It
is separate from domain review, calibration, scientific validity and partner
acceptance. Label synthetic examples and keep the original source relationships.
Follow the [release process](docs/release-process.md) for coordinated beta changes.
Report security concerns privately through [the security policy](SECURITY.md).
