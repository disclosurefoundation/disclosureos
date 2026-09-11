"""Check field accounting and baseline identities, not semantic equivalence."""
import csv
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
raw = (root / 'packages/disclosureos-records/schema/records.schema.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '4d4819d4336c5702ad20758e1c8886caf4fb36f633d3dfeb97fad5e879998679'
schema = json.loads(raw)
roots = {'physicalEvidence'}
expected = {}
def pointer(ref):
    node = schema
    for key in ref.removeprefix('#/').split('/'):
        node = node[key.replace('~1', '/').replace('~0', '~')]
    return node
def visit(node, path, ref):
    if '$ref' in node:
        return visit(pointer(node['$ref']), path, node['$ref'])
    assert path not in expected, path
    expected[path] = ref
    children(node, path, ref)
def children(node, path, ref):
    for key, child in node.get('properties', {}).items():
        visit(child, path + '.' + key, ref + '/properties/' + key)
    if 'items' in node:
        item = node['items']
        children(pointer(item['$ref']) if '$ref' in item else item, path + '[]', item.get('$ref', ref + '/items'))
    for branch in ['anyOf', 'oneOf', 'allOf']:
        for index, child in enumerate(node.get(branch, [])):
            children(child, f'{path}<{branch}:{index}>', f'{ref}/{branch}/{index}')
for name, node in schema['$defs']['Observation']['properties'].items():
    if name in roots:
        visit(node, name, '#/$defs/Observation/properties/' + name)
with (root / 'docs/c2/archival-baseline-mapping.csv').open() as stream:
    shared = [r for r in csv.DictReader(stream) if r['owner'] == 'C2b archival / C2c physical custody']
assert shared
for row in shared:
    expected[row['baseline_path']] = row['schema_pointer']
with (root / 'docs/c2/material-baseline-mapping.csv').open() as stream:
    rows = list(csv.DictReader(stream))
assert len(rows) == len(expected)
assert {r['baseline_path']:r['schema_pointer'] for r in rows} == expected
assert len({r['baseline_path'] for r in rows}) == len(rows)
assert all(r['destination'] and r['meaning'] and r['disposition'] in {'existing','reorganized','revised','deferred'} for r in rows)
assert all(r['owner'] in {'C2c material foundation','C2c laboratory and review'} for r in rows)
print(f'{len(rows)} physical material and shared custody occurrences accounted for; laboratory review remains explicitly separate.')
