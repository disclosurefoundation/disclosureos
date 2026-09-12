"""Account for presentation-domain fields without claiming application enforcement."""
import csv
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
raw = (root / 'packages/disclosureos-records/schema/records.schema.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '4d4819d4336c5702ad20758e1c8886caf4fb36f633d3dfeb97fad5e879998679'
schema = json.loads(raw)
expected = {name: '#/$defs/Observation/properties/' + name for name in ['description', 'status', 'internalNotes', 'media', 'featuredMedia']}
for name in ['media', 'featuredMedia']:
    for field in schema['$defs']['MediaAttachment']['properties']:
        expected[name + '.' + field] = '#/$defs/MediaAttachment/properties/' + field
with (root / 'docs/c3/presentation-baseline-mapping.csv').open() as stream:
    rows = list(csv.DictReader(stream))
assert len(rows) == len(expected)
assert {r['baseline_path']: r['schema_pointer'] for r in rows} == expected
for r in rows:
    assert r['destination'] and r['meaning']
assert next(r for r in rows if r['baseline_path'] == 'internalNotes')['disposition'] == 'pending_application'
assert next(r for r in rows if r['baseline_path'] == 'status')['disposition'] == 'partial'
print(f'{len(rows)} presentation property occurrences accounted for; application enforcement remains pending.')
