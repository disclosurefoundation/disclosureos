"""Check baseline field accounting, not automatic conversion or scientific equivalence."""
import csv
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
raw = (root / 'packages/disclosureos-records/schema/records.schema.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '4d4819d4336c5702ad20758e1c8886caf4fb36f633d3dfeb97fad5e879998679'
schema = json.loads(raw)
assert schema['$defs']['Observation']['properties']['dataSourceId']['type'] == 'string'
with (root / 'docs/c3/link-baseline-mapping.csv').open() as stream:
    rows = list(csv.DictReader(stream))
assert len(rows) == 1
row = rows[0]
assert row['baseline_path'] == 'dataSourceId'
assert row['schema_pointer'] == '#/$defs/Observation/properties/dataSourceId'
assert row['disposition'] == 'revised' and row['owner'] == 'C3c supplemental links'
assert row['destination'] and row['meaning']
print('1 source-association property accounted for; no automatic receipt or access inference.')
