---
"@disclosureos/records": minor
"@disclosureos/schema": minor
---

Add observation revision 0.2.0 with an explicit unknown processing time while
preserving the published 0.1.0 schema and exact UTC strings.
Derived products retain their method, actor and input/output relationships without
inventing a date. The field is still required and all lineage validation remains
active. Consumers should narrow the processing-time union before reading a UTC
instant. This is an unpublished Beta 5 candidate; no package versions are changed.
