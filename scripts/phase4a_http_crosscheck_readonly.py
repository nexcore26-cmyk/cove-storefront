#!/usr/bin/env python3
"""Read-only Phase 4A HTTP cross-check for approval-required cleanup candidates.

This script reads the Phase 4A approval-required candidate CSV, checks public URL
accessibility for each row, and writes a row-level CSV plus summary JSON. It does
not modify the database or delete/write/move any media files.
"""

from __future__ import annotations

import csv
import json
import os
import ssl
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlsplit, urlunsplit
from urllib.request import Request, urlopen

BASE_URL = "https://app.coveinterior.com"
TIMEOUT_SECONDS = 20


def check_url(url: str) -> Dict[str, str]:
    full_url = BASE_URL + url if url.startswith("/media/") else url
    parts = urlsplit(full_url)
    encoded_path = quote(parts.path, safe="/%:@")
    encoded_query = quote(parts.query, safe="=&?/%:@,+")
    full_url_encoded = urlunsplit((parts.scheme, parts.netloc, encoded_path, encoded_query, parts.fragment))
    result = {
        "httpUrl": full_url,
        "httpEncodedUrl": full_url_encoded,
        "httpOk": "false",
        "httpStatus": "",
        "httpContentType": "",
        "httpContentLength": "",
        "httpError": "",
        "httpMethod": "HEAD",
    }
    context = ssl.create_default_context()
    headers = {"User-Agent": "CovePhase4AReadOnlyCrossCheck/1.0"}
    try:
        req = Request(full_url_encoded, method="HEAD", headers=headers)
        with urlopen(req, timeout=TIMEOUT_SECONDS, context=context) as resp:
            status = getattr(resp, "status", resp.getcode())
            result["httpStatus"] = str(status)
            result["httpContentType"] = resp.headers.get("content-type", "")
            result["httpContentLength"] = resp.headers.get("content-length", "")
            result["httpOk"] = "true" if status == 200 else "false"
    except HTTPError as exc:
        result["httpStatus"] = str(exc.code)
        result["httpContentType"] = exc.headers.get("content-type", "") if exc.headers else ""
        result["httpContentLength"] = exc.headers.get("content-length", "") if exc.headers else ""
        result["httpError"] = f"HTTPError: {exc.reason}"
    except (URLError, TimeoutError, ssl.SSLError, OSError) as exc:
        result["httpError"] = f"{type(exc).__name__}: {exc}"
    return result


def int_field(row: Dict[str, str], name: str) -> int:
    try:
        val = row.get(name, "")
        return int(float(val)) if val != "" else 0
    except Exception:
        return 0


def main() -> int:
    if len(sys.argv) != 4:
        print("Usage: phase4a_http_crosscheck_readonly.py <input_csv> <output_csv> <summary_json>", file=sys.stderr)
        return 2

    input_csv = Path(sys.argv[1])
    output_csv = Path(sys.argv[2])
    summary_json = Path(sys.argv[3])
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    summary_json.parent.mkdir(parents=True, exist_ok=True)

    with input_csv.open(newline="", encoding="utf-8") as f:
        rows: List[Dict[str, str]] = list(csv.DictReader(f))

    checked: List[Dict[str, str]] = []
    started = time.time()
    for idx, row in enumerate(rows, 1):
        http = check_url(row.get("url", ""))
        merged = dict(row)
        merged.update(http)
        merged["fileSizeMatchesHttpLength"] = ""
        if merged.get("fileSizeBytes") and merged.get("httpContentLength"):
            try:
                merged["fileSizeMatchesHttpLength"] = "true" if int(float(merged["fileSizeBytes"])) == int(merged["httpContentLength"]) else "false"
            except Exception:
                merged["fileSizeMatchesHttpLength"] = "unknown"
        checked.append(merged)
        if idx % 25 == 0 or idx == len(rows):
            print(f"checked {idx}/{len(rows)}", flush=True)

    fieldnames = list(checked[0].keys()) if checked else []
    with output_csv.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(checked)

    summary = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "inputCsv": str(input_csv),
        "outputCsv": str(output_csv),
        "candidateRowsChecked": len(checked),
        "elapsedSeconds": round(time.time() - started, 2),
        "httpOkCounts": dict(Counter(r.get("httpOk", "") for r in checked)),
        "httpStatusCounts": dict(Counter(r.get("httpStatus", "") for r in checked)),
        "classificationCounts": dict(Counter(r.get("classification", "") for r in checked)),
        "kindCounts": dict(Counter(r.get("kind", "") for r in checked)),
        "referenceCountTotalCounts": dict(Counter(r.get("usageCountTotal", "") for r in checked)),
        "activeReferenceRows": sum(1 for r in checked if int_field(r, "usageCountCommerceActive") or int_field(r, "usageCountCmsActive")),
        "historicalOrderReferenceRows": sum(1 for r in checked if int_field(r, "usageCountHistoricalOrder")),
        "fileSizeMismatchRows": sum(1 for r in checked if r.get("fileSizeMatchesHttpLength") == "false"),
        "safeguards": [
            "No database writes executed",
            "No filesystem writes, deletes, or moves executed",
            "HTTP checks are read-only HEAD requests",
            "All cleanup rows remain approval-only until explicit row-level approval",
        ],
    }
    with summary_json.open("w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)
    print(json.dumps(summary, indent=2), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
