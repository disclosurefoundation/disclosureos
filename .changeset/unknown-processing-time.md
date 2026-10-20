---
"@disclosureos/records": minor
"@disclosureos/schema": minor
---

Allow an explicit unknown processing time while preserving exact UTC strings.
Derived products retain their method, actor and input/output relationships without
inventing a date. The field is still required and all lineage validation remains
active. Consumers should narrow the performance-time union before reading a UTC
instant. This is an unpublished Beta 5 candidate; no package versions are changed.
