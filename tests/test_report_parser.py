"""Tests for the Markdown report parser."""

from dashboard.report_parser import Finding, extract_severity_counts, parse_finding, parse_report

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


def test_parse_finding_uses_section_severity_fallback():
    block = """**1. Weak Password Hashing Using SHA-256 (A02: Cryptographic Failures)**
- **File**: src/auth.py:27-45
- **Description**: Passwords are hashed with SHA-256.
- **Remediation**: Replace SHA-256 with Argon2.
"""

    finding = parse_finding(block, section_severity="critical")

    assert finding is not None
    assert finding.severity == "CRITICAL"
    assert finding.owasp == "A02 - Cryptographic Failures"


def test_parse_finding_ignores_boundary_only_labels_between_fields():
    block = """**1. Weak Password Hashing Using SHA-256 (A02: Cryptographic Failures)**
- **Severity**: CRITICAL
- **OWASP**: A02 - Cryptographic Failures
- **File**: src/auth.py:27-45
- **Rule Violated**: Password storage must use a modern password hashing algorithm.
- **Description**: Passwords are hashed with SHA-256.
- **Code**: hashlib.sha256(password.encode()).hexdigest()
- **Remediation**: Replace SHA-256 with Argon2.
- **SbD Principle**: Defense in Depth
"""

    finding = parse_finding(block)

    assert finding is not None
    assert finding.file == "src/auth.py:27-45"
    assert finding.description == "Passwords are hashed with SHA-256."
    assert finding.remediation == "Replace SHA-256 with Argon2."


def test_extract_severity_counts():
    findings = [
        Finding(title="1", severity="CRITICAL"),
        Finding(title="2", severity="HIGH"),
        Finding(title="3", severity="HIGH"),
        Finding(title="4", severity="LOW"),
        Finding(title="5", severity="INFO"),
    ]
    counts = extract_severity_counts(findings)
    assert counts["CRITICAL"] == 1
    assert counts["HIGH"] == 2
    assert counts["MEDIUM"] == 0
    assert counts["LOW"] == 1
    assert counts["INFO"] == 1


def test_parse_report_fixture_with_separators(tmp_path):
    """Test full document parsing for the legacy separator-based format."""
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
    md_file.write_text(report_content, encoding="utf-8")

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


def test_parse_report_without_separators(tmp_path):
    """Test robust parsing when findings are grouped only by severity headings."""
    report_content = """# Security Review Report

## Executive Summary
This is a summary.

## Tech Stack Fingerprint
- Python
- SQLite

## Findings by Severity
### CRITICAL

**1. Weak Password Hashing Using SHA-256 (A02: Cryptographic Failures)**
- **File**: src/auth.py:27-45
- **Description**: The authentication module uses SHA-256 for password hashing.
- **Remediation**: Replace SHA-256 with Argon2.

**2. Extremely Weak Minimum Password Length Policy (A02: Cryptographic Failures)**
- **File**: src/auth.py:21
- **Description**: The minimum password length is 4 characters.
- **Remediation**: Increase the minimum password length to at least 8.

### HIGH

**3. No Centralized Security Event Logging (A09: Security Logging and Monitoring Failures)**
- **File**: app.py
- **Description**: Security-relevant events are not logged.
- **Remediation**: Add centralized audit logging.

### INFO

**4. Informational Finding**
- **Severity**: INFO
- **OWASP**: A05 - Security Misconfiguration
- **File**: docs/security.md
- **Description**: Additional hardening guidance is available.
- **Remediation**: Review the hardening guide.

## Recommendations
Fix them all.
"""
    md_file = tmp_path / "security_report.md"
    md_file.write_text(report_content, encoding="utf-8")

    report = parse_report(md_file)

    assert len(report.findings) == 4

    assert report.findings[0].title == "Weak Password Hashing Using SHA-256 (A02: Cryptographic Failures)"
    assert report.findings[0].severity == "CRITICAL"
    assert report.findings[0].owasp == "A02 - Cryptographic Failures"

    assert report.findings[1].title == "Extremely Weak Minimum Password Length Policy (A02: Cryptographic Failures)"
    assert report.findings[1].severity == "CRITICAL"
    assert report.findings[1].owasp == "A02 - Cryptographic Failures"

    assert report.findings[2].title == "No Centralized Security Event Logging (A09: Security Logging and Monitoring Failures)"
    assert report.findings[2].severity == "HIGH"
    assert report.findings[2].owasp == "A09 - Security Logging and Monitoring Failures"

    assert report.findings[3].title == "Informational Finding"
    assert report.findings[3].severity == "INFO"
    assert report.findings[3].owasp == "A05 - Security Misconfiguration"
