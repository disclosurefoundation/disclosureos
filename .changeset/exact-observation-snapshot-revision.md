---
"@disclosureos/schema": patch
---

Reject a case snapshot whose Observation revision differs from its declared
schema reference, even when its document ID and byte digest match. This closes a
consumer compatibility gap introduced by support for Observation 0.2.0 without
changing published schema identities or upgrading existing claim envelopes.
