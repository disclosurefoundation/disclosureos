# M-014 · Handling and storage record

Entirely fictional source. The events below are declared scenario history, not verified physical custody. Dates have day-level precision; array order does not supply an unrecorded time.

## Parent specimen

On 15 August, the Meridian collector placed parent specimen M-014 in a labeled jar and applied seal M014-P-01. The collection sheet identifies the material and site. The start of this chain is the declared collection action. It does not inherit an undocumented history of the soil before collection or establish how the surface mark formed.

The same day, the sealed jar passed from the collector to the Meridian laboratory custodian. The log records the same label at receipt. The custodian placed it in cabinet S1. No real storage temperature, humidity or seal inspection was measured. The example records what a source declares and leaves physical verification outside the software check.

On 16 August, the preparation operator retrieved the jar and opened M014-P-01 for the procedure described in the preparation protocol. The source record links that action to the prior storage action. The preparation produces new material identities. The original parent is not subsequently shown as an intact jar containing its original amount, because its contents have been divided.

## Derived materials

Portion M-014-B is the retained 60 g portion. It is placed under seal M014-B-01 in cabinet S2, with no analytical result assigned. The preparation of portion A produces a 5 g analytical portion, M-014-A1, and a 55 g retained remainder, M-014-A-R. The remainder is placed under M014-AR-01 in S2. The analytical portion proceeds into the fictional measurement workflow.

Each derived portion begins its custody record at its own preparation. It does not simply copy the parent's transfer history as if the portion had existed at collection. A reader can follow its lineage to the parent and inspect both histories, while the identities remain separate. A custody predecessor must refer to an action on the same specimen, not to an action on a sibling or the parent.

## Source table and review boundary

The [custody table](custody.csv) is generated from the scenario's declared actions. It preserves dates, material IDs, predecessor IDs, holders and seals. Its local action labels belong to this authoring inventory; the later canonical adapter must map them to the supported contract vocabulary without inventing new enum values.

The primary chain is intentionally complete as a declaration. A separate reference example is specified for an unknown predecessor, an unreadable seal record and a missing receipt. Those conditions should remain visible when that example is built. A successful reference check on this log would establish that the supplied relationships are consistent, not that the material or its handlers are authentic.
