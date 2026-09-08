"""Independent standard-library receipt integrity checker, not an evaluation validator."""
import hashlib
import json
import os
from pathlib import Path
import re
import stat
import sys

LIMIT = 8 * 1024 * 1024


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON key: " + key)
        result[key] = value
    return result


def decode(text):
    def invalid_constant(value):
        raise ValueError("Invalid JSON constant: " + value)
    return json.loads(text, object_pairs_hook=unique_object, parse_constant=invalid_constant)


def exact_keys(value, keys, label):
    if type(value) is not dict or set(value) != set(keys):
        raise ValueError("Unexpected " + label + " fields")


def verify(data):
    if len(data) > LIMIT:
        raise ValueError("Receipt exceeds 8 MiB limit")
    receipt = decode(data.decode("utf-8", errors="strict"))
    exact_keys(receipt, ["format", "serialization", "request", "output", "requestJson", "outputJson"], "receipt")
    formats = {
        "disclosureos-research-evaluation-receipt:0.1.0": ["packet", "completion"],
        "disclosureos-assessment-summary-receipt:0.1.0": ["summary"],
        "disclosureos-profile-evaluation-receipt:0.1.0": ["profile"],
    }
    if type(receipt["format"]) is not str or receipt["format"] not in formats:
        raise ValueError("Unsupported receipt format")
    if receipt["serialization"] != "sorted-json-utf8:0.1.0":
        raise ValueError("Unsupported serialization")
    checks = {}
    for name in ["request", "output"]:
        pin = receipt[name]
        exact_keys(pin, ["sha256", "byteLength"], name + " pin")
        if type(pin["sha256"]) is not str or not re.fullmatch(r"[a-f0-9]{64}", pin["sha256"]):
            raise ValueError("Invalid SHA-256 pin")
        if type(pin["byteLength"]) is not int or not 1 <= pin["byteLength"] <= 9007199254740991:
            raise ValueError("Invalid byte-length pin")
        text = receipt[name + "Json"]
        if type(text) is not str:
            raise ValueError("Payload must be a JSON string")
        raw = text.encode("utf-8", errors="strict")
        if len(raw) != pin["byteLength"] or hashlib.sha256(raw).hexdigest() != pin["sha256"]:
            raise ValueError(name + " payload differs from its exact-byte pin")
        payload = decode(text)
        exact_keys(payload, ["manifest", "rules", "limits"] if name == "request" else formats[receipt["format"]], name + " payload")
        if any(type(v) is not dict for v in payload.values()):
            raise ValueError("Payload sections must be JSON objects")
        checks[name] = "passed"
    return {"success": True, "checks": checks, "scope": "receipt_payload_integrity", "canonicalSerialization": "not_checked", "inputFiles": "not_checked", "evaluationSemantics": "not_checked", "replay": "not_checked", "authorship": "not_attested", "scientificEligibility": "not_checked"}


def read_local(path):
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_NONBLOCK", 0))
    with os.fdopen(fd, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode):
            raise ValueError("Expected a regular receipt file")
        if info.st_size > LIMIT:
            raise ValueError("Receipt exceeds 8 MiB limit")
        return stream.read(LIMIT + 1)


def main():
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: python3 scripts/verify-research-receipt.py <receipt.json|->")
        data = sys.stdin.buffer.read(LIMIT + 1) if sys.argv[1] == "-" else read_local(Path(sys.argv[1]))
        result = verify(data)
    except (ValueError, OSError, UnicodeError, RecursionError) as error:
        result = {"success": False, "scope": "receipt_payload_integrity", "error": str(error), "evaluationSemantics": "not_checked", "replay": "not_checked", "scientificEligibility": "not_checked"}
    print(json.dumps(result, ensure_ascii=True))
    return 0 if result["success"] else 1


if __name__ == "__main__":
    sys.exit(main())
