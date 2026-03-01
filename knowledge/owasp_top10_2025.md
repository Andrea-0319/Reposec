# OWASP Top 10 (2025 Edition Reference)

1. **A01: Broken Access Control**: Failures to properly restrict user access to resources or actions. Can lead to unauthorized information disclosure, modification, or destruction of data.
2. **A02: Cryptographic Failures**: Weaknesses in cryptography leading to sensitive data exposure. Includes storing passwords in plain text, using weak algorithms, or improper key management.
3. **A03: Injection**: Flaws such as SQL, NoSQL, OS, and LDAP injection occur when untrusted data is sent to an interpreter as part of a command or query.
4. **A04: Insecure Design**: Flaws related to missing or ineffective control design. E.g., not having security controls in the architecture from the beginning.
5. **A05: Security Misconfiguration**: Insecure default settings, incomplete configurations, open cloud storage, misconfigured HTTP headers, and verbose error messages containing sensitive information.
6. **A06: Vulnerable and Outdated Components**: Using components with known vulnerabilities. E.g., outdated libraries, unpatched OS.
7. **A07: Identification and Authentication Failures**: Improper implementation of authentication and session management. Includes credential stuffing, weak passwords.
8. **A08: Software and Data Integrity Failures**: Making assumptions related to software updates, critical data, and CI/CD pipelines without verifying integrity. E.g., insecure deserialization.
9. **A09: Security Logging and Monitoring Failures**: Lack of appropriate logging and alerting, allowing attackers to maintain persistence or extract data unseen.
10. **A10: Server-Side Request Forgery (SSRF)**: Flaws occurring when a web application fetches a remote resource without validating the user-supplied URL.
