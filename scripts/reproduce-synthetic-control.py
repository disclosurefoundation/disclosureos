"""Independent exact-byte and synthetic arithmetic consumer, not a Python research validator."""
import hashlib
import json
import math
from pathlib import Path
import re
import sys

folder = Path(__file__).resolve().parent.parent / 'examples/v2/reproduction-demo'
def decode(data):
    return json.loads(data.decode('utf-8'), parse_constant=lambda s: (_ for _ in ()).throw(ValueError(s)))
packet_bytes = (folder / 'packet.json').read_bytes()
packet = decode(packet_bytes)
files = {}
for entry in packet['files']:
    key = entry['id']
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]*', key) or key in files:
        raise ValueError('Invalid or duplicate file ID')
    data = (folder / 'files' / key).read_bytes()
    if len(data) != entry['byteLength'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
        raise ValueError('Pinned bytes differ: ' + key)
    files[key] = data
method = packet['method']
if method['id'] != 'synthetic-radial-velocity-mean' or method['version'] != '1':
    raise ValueError('Unsupported fixed method')
if next(v['fileRef'] for v in packet['assets']['context'] if v['ref'] == 'product:captured-raw') != method['inputRef'] or next(v['fileRef'] for v in packet['assets']['observation'] if v['ref'] == 'product:summary') != method['expectedOutputRef']:
    raise ValueError('Method inputs differ from synthetic mapping')
implementation = next(v for v in method['implementations'] if v['id'] == 'python')
if Path(__file__).read_bytes() != files[implementation['artifactRef']]:
    raise ValueError('Running source differs from pinned implementation')
env = decode(files[implementation['environmentRef']])
if env != {'runtime': 'python', 'major': sys.version_info.major, 'arithmetic': 'binary64-ordered-sum'}:
    raise ValueError('Runtime differs from declared environment')
samples = decode(files[method['inputRef']])['samples']
if not isinstance(samples, list) or not samples or any(type(v) not in (float, int) or not math.isfinite(float(v)) for v in samples):
    raise ValueError('Expected nonempty finite samples')
total = 0.0
for sample in samples:
    total += float(sample)
value = total / len(samples)
expected = decode(files[method['expectedOutputRef']])['velocity']
tolerance = method['absoluteTolerance']
if type(tolerance) not in (int, float) or not math.isfinite(tolerance) or tolerance < 0:
    raise ValueError('Invalid explicit tolerance')
if method['unit'] != 'm/s' or type(expected) not in (int, float) or not math.isfinite(expected) or not math.isfinite(value) or abs(value - expected) > tolerance:
    raise ValueError('Reproduction differs from expected output')
history = decode(files[packet['documents']['history']])
measurement = next(v for v in history['observation']['measurements'] if 'measurement:' + v['id'] == method['measurementRef'])
if measurement['value']['unit'] != method['unit'] or abs(value - measurement['value']['value']) > tolerance:
    raise ValueError('Reproduction differs from mapped measurement')
print(json.dumps({'packetId': packet['id'], 'packetSha256': hashlib.sha256(packet_bytes).hexdigest(), 'implementationSha256': hashlib.sha256(files[implementation['artifactRef']]).hexdigest(), 'environmentSha256': hashlib.sha256(files[implementation['environmentRef']]).hexdigest(), 'method': method['id'], 'version': method['version'], 'value': value, 'unit': method['unit'], 'absoluteTolerance': tolerance, 'implementation': 'python', 'runtime': sys.version.split()[0], 'fileIdentityVerified': True, 'researchPrerequisites': 'not_checked', 'scientificEligibility': 'not_checked'}))
