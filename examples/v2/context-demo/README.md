# Fictional context control

All records, measurements, people, equipment and artifacts here are synthetic.
None are partner data or scientific findings. Requires the C1 package candidate;
published 2.0.0-beta.0 does not yet export its evaluator.

From the repository root, build with `pnpm --filter '@disclosureos/schema...' build`
and run `node examples/v2/context-demo/run.mjs`.

The history cites context, observation and acquisition JSON by exact SHA-256.
Optical/radio channels remain independent, shape accounts conflict, and alignment
and measurement uncertainty remain unknown. The successful result checks supplied
snapshot bytes and declared references, not source authenticity or sensor fusion.

`fixture.mjs` generates all inputs. Regenerate committed files with
`node conformance/emit-context-example.mjs`; conformance tests check their bytes.
