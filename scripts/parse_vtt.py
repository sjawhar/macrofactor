#!/usr/bin/env python3
"""Parse YouTube VTT auto-captions into clean readable transcript."""

import re
import sys
from pathlib import Path


def parse_vtt(vtt_path: str) -> str:
    text = Path(vtt_path).read_text(encoding="utf-8")
    lines = text.splitlines()

    seen = set()
    clean_lines = []

    for line in lines:
        # Skip WEBVTT header, timestamps, empty lines, and metadata
        if (
            line.startswith("WEBVTT")
            or line.startswith("Kind:")
            or line.startswith("Language:")
            or re.match(r"\d{2}:\d{2}:\d{2}\.\d{3} -->", line)
            or line.strip() == ""
        ):
            continue

        # Strip word-level timing tags: <00:00:XX.XXX><c> ... </c>
        clean = re.sub(r"<\d{2}:\d{2}:\d{2}\.\d{3}>", "", line)
        clean = re.sub(r"</?c>", "", clean)
        clean = clean.strip()

        if not clean or clean == "[Music]":
            continue

        # Deduplicate consecutive repeated lines (YouTube quirk)
        if clean not in seen:
            seen.add(clean)
            clean_lines.append(clean)
        else:
            # Reset seen on each "paragraph" (new context)
            seen.clear()
            seen.add(clean)

    # Join into paragraphs — add newline when sentence ends
    result = []
    buffer = []
    for line in clean_lines:
        buffer.append(line)
        if line.rstrip().endswith((".", "?", "!", ":")):
            result.append(" ".join(buffer))
            buffer = []
    if buffer:
        result.append(" ".join(buffer))

    return "\n\n".join(result)


if __name__ == "__main__":
    vtt_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sbs_test.en.vtt"
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    transcript = parse_vtt(vtt_file)
    if output_file:
        Path(output_file).write_text(transcript, encoding="utf-8")
        print(f"Written to {output_file}")
    else:
        print(transcript[:3000])
