"""Agent I/O configuration for the Security Review System."""

AGENT_IO = {
    "ingest": {
        "context_files": [],
        "output_file": "fingerprint.md",
        "output_instruction": (
            "Explore the repository using your built-in file reading tools. "
            "Write your findings, including a comprehensive file and directory manifest, "
            "in 'fingerprint.md' in the current directory."
        ),
    },
    "backend_security": {
        "context_files": ["fingerprint.md"],
        "output_file": "findings_backend.md",
        "output_instruction": (
            "Analyze the backend source code for security flaws. Write your findings "
            "in 'findings_backend.md' in the current directory. "
            "Format: ## Finding N\n- Severity: ...\n- OWASP: ...\n- File: ...\n- Code Snippet: ...\n- Principle: ..."
        ),
    },
    "frontend_security": {
        "context_files": ["fingerprint.md"],
        "output_file": "findings_frontend.md",
        "output_instruction": (
            "Analyze the frontend source code for security flaws. Write your findings "
            "in 'findings_frontend.md' in the current directory. "
            "Format: ## Finding N\n- Severity: ...\n- OWASP: ...\n- File: ...\n- Code Snippet: ...\n- Principle: ..."
        ),
    },
    "secrets_config": {
        "context_files": ["fingerprint.md"],
        "output_file": "findings_secrets.md",
        "output_instruction": (
            "Analyze the source code and configuration files for exposed secrets and misconfigurations. "
            "Write your findings in 'findings_secrets.md' in the current directory. "
            "Format: ## Finding N\n- Severity: ...\n- OWASP: ...\n- File: ...\n- Code Snippet: ...\n- Principle: ..."
        ),
    },
    "dependency_risk": {
        "context_files": ["fingerprint.md"],
        "output_file": "findings_deps.md",
        "output_instruction": (
            "Analyze dependencies and package manifests for known risks (e.g., outdated or vulnerable packages). "
            "Write your findings in 'findings_deps.md' in the current directory. "
            "Format: ## Finding N\n- Severity: ...\n- OWASP: ...\n- File: ...\n- Risk: ...\n- Principle: ..."
        ),
    },
    "compliance": {
        "context_files": ["fingerprint.md", "findings_backend.md", "findings_frontend.md", "findings_secrets.md", "findings_deps.md"],
        "output_file": "findings_compliance.md",
        "output_instruction": (
            "Analyze all collected findings and code context to assess overall compliance with OWASP Top 10 "
            "and Secure by Design principles. Identify any gaps. "
            "Write your findings in 'findings_compliance.md' in the current directory. "
        ),
    },
    "aggregator": {
        "context_files": [
            "fingerprint.md",
            "findings_backend.md", "findings_frontend.md",
            "findings_secrets.md", "findings_deps.md", "findings_compliance.md"
        ],
        "output_file": "security_report.md",
        "output_instruction": (
            "Consolidate and deduplicate all findings into a unified final report. "
            "Write 'security_report.md' in the current directory, with an executive summary, "
            "detailed list of findings categorized by severity, and final recommendations."
        ),
    },
}
