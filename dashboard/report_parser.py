"""Parses security_report.md and fingerprint.md into structured data.

Uses regex-based parsing calibrated on the consistent Markdown structure
produced by the aggregator agent. Each finding follows a strict pattern:
  **N. Title**
  - **Severity**: ...
  - **OWASP**: ...
  - **File**: ...
  - **Description**: ...
  - **Remediation**: ...
"""
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class Finding:
    title: str
    severity: str = ""
    owasp: str = ""
    file: str = ""
    description: str = ""
    remediation: str = ""


@dataclass
class ProjectInfo:
    """Extracted from fingerprint.md."""
    name: str = "Unknown Project"
    project_type: str = "Unknown"


@dataclass
class ReportData:
    """Full parsed report."""
    executive_summary: str = ""
    tech_stack: str = ""
    findings: List[Finding] = field(default_factory=list)
    recommendations: str = ""


# ---------------------------------------------------------------------------
# Regex patterns (compiled once)
# ---------------------------------------------------------------------------
# Matches: **1. Some Title**  or  **2. Title With (Parentheses)**
_FINDING_TITLE_RE = re.compile(
    r"^\*\*\d+\.\s+(.+?)\*\*\s*$", re.MULTILINE
)

# Field labels inside a finding block
_FIELD_LABELS = {
    "severity": "Severity",
    "owasp": "OWASP",
    "file": "File",
    "description": "Description",
    "remediation": "Remediation",
}

_BOUNDARY_LABELS = {
    *_FIELD_LABELS.values(),
    "Rule Violated",
    "Code",
    "SbD Principle",
}

_SECTION_SEVERITY_RE = re.compile(
    r"^###\s+(CRITICAL|HIGH|MEDIUM|LOW|INFO)\s*$",
    re.IGNORECASE | re.MULTILINE,
)

_OWASP_FROM_TITLE_RE = re.compile(
    r"\((A\d{2})\s*:\s*([^)]+)\)",
    re.IGNORECASE,
)


# ---------------------------------------------------------------------------
# Finding parser
# ---------------------------------------------------------------------------
def _extract_field(text_block: str, label: str) -> str:
    """Extract a field value from a finding block, supporting multiline values."""
    known_labels = "|".join(re.escape(boundary_label) for boundary_label in _BOUNDARY_LABELS)
    pattern = re.compile(
        rf"(?:^|\n)-?\s*\*\*{re.escape(label)}\*\*:\s*(.+?)"
        rf"(?=\n(?:-?\s*\*\*(?:{known_labels})\*\*:|###\s+|\*\*\d+\.\s+.+?\*\*\s*$|---\s*$)|\Z)",
        re.IGNORECASE | re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text_block)
    return match.group(1).strip() if match else ""


def _extract_owasp_from_title(title: str) -> str:
    """Extract OWASP category from a finding title when embedded in parentheses."""
    match = _OWASP_FROM_TITLE_RE.search(title)
    if not match:
        return ""

    code, category = match.groups()
    return f"{code.upper()} - {category.strip()}"


def parse_finding(text_block: str, section_severity: str = "") -> Optional[Finding]:
    """Parse a single finding text block into a Finding dataclass.

    Returns None if the block doesn't look like a valid finding.
    """
    title_match = _FINDING_TITLE_RE.search(text_block)
    if not title_match:
        return None

    finding = Finding(title=title_match.group(1).strip())

    for field_name, label in _FIELD_LABELS.items():
        value = _extract_field(text_block, label)
        if value:
            setattr(finding, field_name, value)

    if not finding.severity and section_severity:
        finding.severity = section_severity.strip().upper()

    if not finding.owasp:
        finding.owasp = _extract_owasp_from_title(finding.title)

    return finding


# ---------------------------------------------------------------------------
# Report parser
# ---------------------------------------------------------------------------
def _extract_section(text: str, heading: str, next_headings: List[str]) -> str:
    """Extract text between `heading` and the next known heading at same level."""
    # Build pattern: match heading, capture everything until next heading or EOF
    escaped = re.escape(heading)
    next_pattern = "|".join(re.escape(h) for h in next_headings) if next_headings else "$"
    pattern = re.compile(
        rf"^##\s+{escaped}\s*\n(.*?)(?=^##\s+(?:{next_pattern})\s*\n|\Z)",
        re.MULTILINE | re.DOTALL,
    )
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def parse_report(md_path: str | Path) -> ReportData:
    """Parse a security_report.md into structured ReportData."""
    path = Path(md_path)
    if not path.exists():
        return ReportData()

    text = path.read_text(encoding="utf-8", errors="replace")
    report = ReportData()

    # Extract known sections (order matters for boundary detection)
    sections = [
        "Executive Summary",
        "Tech Stack Fingerprint",
        "Findings by Severity",
        "Recommendations",
    ]
    report.executive_summary = _extract_section(text, sections[0], sections[1:])
    report.tech_stack = _extract_section(text, sections[1], sections[2:])
    report.recommendations = _extract_section(text, sections[3], [])

    # Parse individual findings from the "Findings by Severity" section
    findings_text = _extract_section(text, sections[2], sections[3:])
    if findings_text:
        section_headers = [
            (match.start(), match.group(1).upper())
            for match in _SECTION_SEVERITY_RE.finditer(findings_text)
        ]
        title_matches = list(_FINDING_TITLE_RE.finditer(findings_text))

        for index, match in enumerate(title_matches):
            block_start = match.start()
            block_end = (
                title_matches[index + 1].start()
                if index + 1 < len(title_matches)
                else len(findings_text)
            )
            block = findings_text[block_start:block_end].strip()

            section_severity = ""
            for header_position, severity in section_headers:
                if header_position <= block_start:
                    section_severity = severity
                else:
                    break

            finding = parse_finding(block, section_severity=section_severity)
            if finding:
                report.findings.append(finding)

    return report


def extract_severity_counts(findings: List[Finding]) -> Dict[str, int]:
    """Count findings per severity level."""
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        sev = f.severity.upper()
        if sev in counts:
            counts[sev] += 1
    return counts


# ---------------------------------------------------------------------------
# Fingerprint parser
# ---------------------------------------------------------------------------
def parse_fingerprint(md_path: str | Path) -> ProjectInfo:
    """Extract project name and type from a fingerprint.md file.

    Handles two common header formats:
      - "# ProjectName - Project Fingerprint"
      - "# Project Fingerprint: ProjectName"
    """
    path = Path(md_path)
    if not path.exists():
        return ProjectInfo()

    text = path.read_text(encoding="utf-8", errors="replace")
    info = ProjectInfo()

    # Try: "# Something - Project Fingerprint"
    m = re.search(r"^#\s+(.+?)\s*[-–—]\s*Project Fingerprint", text, re.MULTILINE)
    if not m:
        # Try: "# Project Fingerprint: Something"
        m = re.search(r"^#\s+Project Fingerprint:\s*(.+)", text, re.MULTILINE)
    if m:
        info.name = m.group(1).strip()

    # Extract Project Name from body: **Project Name:** ...
    name_match = re.search(r"\*\*Project Name:\*\*\s*(.+)", text, re.IGNORECASE)
    if name_match:
        info.name = name_match.group(1).strip()

    # Extract Type: **Type:** ... or **Project Type**: ...
    type_match = re.search(r"\*\*(?:Project\s+)?Type:\*\*\s*(.+)", text, re.IGNORECASE)
    if type_match:
        info.project_type = type_match.group(1).strip()

    return info
