"""Tests for the Markdown Report Parser."""
import pytest
from dashboard.report_parser import parse_report, extract_severity_counts, parse_finding, Finding

def test_parse_single_finding():
    """Test parsing a single finding text block."""
    block = """**1. Weak Password Policy**
- **Severity**: HIGH
- **OWASP**: A07 - Identification
- **File**: auth.py
- **Description**: Minimum length is 4.
- **Remediation**: Set to 8.
"""
    finding = parse_finding(block)
    assert finding is not None
    assert finding.title == "Weak Password Policy"
    assert finding.severity == "HIGH"
    assert finding.owasp == "A07 - Identification"
    assert finding.file == "auth.py"
    assert finding.description == "Minimum length is 4."
    assert finding.remediation == "Set to 8."

def test_extract_severity_counts():
    findings = [
        Finding(title="1", severity="CRITICAL"),
        Finding(title="2", severity="HIGH"),
        Finding(title="3", severity="HIGH"),
        Finding(title="4", severity="LOW"),
    ]
    counts = extract_severity_counts(findings)
    assert counts["CRITICAL"] == 1
    assert counts["HIGH"] == 2
    assert counts["MEDIUM"] == 0
    assert counts["LOW"] == 1

def test_parse_report_fixture(tmp_path):
    """Test full document parsing."""
    report_content = """# Security Review Report

## Executive Summary
This is a summary.

## Tech Stack Fingerprint
- Python
- SQLite

## Findings by Severity
### CRITICAL

**1. Critical Issue**
- **Severity**: CRITICAL
- **Description**: Bad hash.

---
### MEDIUM

**2. Medium Issue**
- **Severity**: MEDIUM
- **File**: src.py

## Recommendations
Fix them all.
"""
    md_file = tmp_path / "security_report.md"
    md_file.write_text(report_content)
    
    report = parse_report(md_file)
    
    assert "This is a summary." in report.executive_summary
    assert "Python" in report.tech_stack
    assert "Fix them all." in report.recommendations
    
    assert len(report.findings) == 2
    assert report.findings[0].title == "Critical Issue"
    assert report.findings[0].severity == "CRITICAL"
    
    assert report.findings[1].title == "Medium Issue"
    assert report.findings[1].severity == "MEDIUM"
    assert report.findings[1].file == "src.py"
