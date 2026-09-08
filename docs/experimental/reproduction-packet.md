# Experimental reproduction packet

A reproduction packet freezes the exact bytes used by the experimental research-prerequisite workflow. It inventories the five input documents, their asset maps, method implementations, environment declarations, calculation input, and expected output. Reformatting a JSON document changes its identity even when its parsed values stay the same.

Contract: `urn:disclosureos:experimental:reproduction-packet:0.1.0`.
Profile: `urn:disclosureos:experimental:profile:reproduction-packet`, version `0.1.0`, scope `exact_bytes_and_research_prerequisites`.

## Verify a packet

```ts
import { evaluateReproductionPacket } from '@disclosureos/schema/experimental/v2';

const result = await evaluateReproductionPacket(packet, {
  files: new Map<string, Uint8Array>(/* file ID and complete local bytes */),
});
```

The caller supplies bytes indexed by local file ID. The verifier has no filesystem paths, URL retrieval, subprocesses, dynamic imports, or evaluation of bundled code. File IDs use the same restricted identifier grammar as other v2 contracts. Extra caller-supplied files outside the packet are ignored; every inventoried file must be referenced and verified. Missing files or unavailable hashing leave the profile unchecked, and byte-length or SHA-256 mismatches fail it. Duplicate file IDs, namespace aliases, implementation IDs, and unresolved file references fail semantic checks.

Only after every file passes does the evaluator decode the five documents as UTF-8 JSON and invoke the existing research-prerequisite evaluator. Invalid UTF-8, BOM-prefixed JSON, and malformed JSON fail. The three asset namespaces are reconstructed explicitly from the packet. Nested research checks retain their limits and diagnostics. A repinned but inconsistent document cannot bypass them. Original schemas, digests embedded in the documents, and explicit missingness all remain authoritative.

The packet pins the research profile at `0.1.0`; its nested contracts and profiles are versioned by that evaluator. No canonical JSON conversion is performed. Document parsing uses native JSON semantics. This is not a signed container or an authorization mechanism: freeze or authenticate the packet manifest itself through the distribution process. Replacing the manifest and all hashes is a different packet, not proof of the original author's approval.

JSON Schema exports are `@disclosureos/schema/experimental/v2/packet/schema` and `/packet/schema/0.1.0`. Regenerate the artifact with `pnpm emit:v2-packet`.

## Fixed synthetic calculation

[`examples/v2/reproduction-demo`](../../examples/v2/reproduction-demo) contains a complete packet. Its synthetic raw samples are `[-2, -3, -4]`; the method computes their ordered binary64 sum divided by count, producing a mean radial velocity of −3 m/s. The pinned expected output and mapped measurement both declare −3 m/s. The comparison uses an explicit absolute tolerance of zero. This is a reproducibility control, not instrument calibration, uncertainty propagation, or a scientific UAP result.

From the repository root after building:

```sh
pnpm reproduce:synthetic:typescript
pnpm reproduce:synthetic:python
```

The TypeScript runner uses Node 22 and the repository's pinned `tsx` toolchain. The Python runner uses Python 3 with only the standard library. Both implementations independently hash the complete file inventory, compare their executing source to the pinned source file, inspect their runtime declaration, perform the arithmetic, and compare the result against the expected output and measurement. The fixed runners accept only the named synthetic method and version. They do not execute implementations selected by an untrusted packet.

Both emit the packet-manifest SHA-256, implementation and environment hashes, actual runtime version, method/version, value, unit, and tolerance. Matching packet IDs alone is insufficient; compare manifest hashes. Runtime declarations specify the compatible runtime major and arithmetic convention, not a hermetic operating-system image. The exact observed runtime is recorded in each output. The TypeScript runner's dependency resolution comes from the repository lockfile; the packet does not yet attest that entire toolchain or operating system.

The TypeScript runner additionally evaluates all research prerequisites. The independent Python runner verifies file identity and arithmetic only; it explicitly returns `researchPrerequisites: "not_checked"`. It is not the full independent Python semantic validator planned for the partner pilot.

## What a passing check means

Packet verification means all declared files match their pins and the composed research prerequisites pass. `methodExecution`, `environmentExecution`, and `scientificEligibility` remain `not_checked` in the library result. Arbitrary method metadata is recorded, not interpreted as an executable algorithm. The separate fixed demo runners provide arithmetic reproduction evidence for their specific method only.

Accepted reviews remain declarations. Pinning prevents silent file replacement under a frozen manifest, but it does not authenticate reviewers, retroactively prove which bytes they saw, establish calibration adequacy, or independently inspect their report content. Review-to-input signatures, hermetic execution, independent semantic conformance, native-file adapters, partner authorization, and qualified scientific review remain outstanding.

`pnpm test:v2-packet` checks schema parity, every missing/corrupt file, same-ID changes, malformed document encodings, snapshot isolation, inert bundled code, and TypeScript/Python agreement. Existing experimental and legacy suites remain separate gates.
