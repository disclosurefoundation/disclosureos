"""Check field accounting and baseline identities, not semantic equivalence."""
import csv
import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
raw = (root / 'packages/disclosureos-records/schema/records.schema.json').read_bytes()
assert hashlib.sha256(raw).hexdigest() == '4d4819d4336c5702ad20758e1c8886caf4fb36f633d3dfeb97fad5e879998679'
schema = json.loads(raw)
roots = {'sourceData', 'documents', 'provenance', 'identifiers'}
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
# C2a explicitly handed these exact source-document occurrences to C2b.
with (root / 'docs/c2/witness-baseline-mapping.csv').open() as stream:
    handed_off = [r for r in csv.DictReader(stream) if r['disposition'] == 'deferred']
assert handed_off and all(r['owner'] == 'C2b documents/digital provenance' for r in handed_off)
for row in handed_off:
    assert row['baseline_path'] not in expected
    expected[row['baseline_path']] = row['schema_pointer']
with (root / 'docs/c2/archival-baseline-mapping.csv').open() as stream:
    rows = list(csv.DictReader(stream))
assert len(rows) == len(expected)
assert {r['baseline_path']: r['schema_pointer'] for r in rows} == expected
assert len({r['baseline_path'] for r in rows}) == len(rows)
assert all(r['destination'] and r['meaning'] and r['disposition'] in {'existing','reorganized','revised','deferred'} for r in rows)
print(f'{len(rows)} C2b source/document/digital/identifier baseline occurrences accounted for; semantic equivalence still requires review.')

assert all(r['owner'] for r in rows)
assert all(r['owner'] in {'C2b archival', 'C2b archival / C2c physical custody'} for r in rows)
