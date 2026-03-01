# Secure by Design (SbD) Principles

1. **Minimize Attack Surface**: Reduce the number of entry points and exposed interfaces available to an attacker. Remove unnecessary features, endpoints, and privileges.
2. **Least Privilege**: Entities (users, processes, systems) should only have the minimum access rights necessary to perform their legitimate functions.
3. **Secure Defaults**: Systems must be secure out of the box. Default settings should deny access, disable debug modes, and enforce strong configurations without user intervention.
4. **Defense in Depth**: Implement multiple overlapping layers of security controls so that if one fails, others are still in place.
5. **Fail Securely**: When an error or exception occurs, the system must fail into a secure state, not exposing sensitive information or granting unauthorized access.
6. **Zero Trust**: Assume the network is hostile; verify explicitly at every step and never trust based solely on internal origin.
7. **Separation of Duties**: Require multiple conditions or entities to grant access to critical operations, mitigating the impact of a single compromised component.
8. **Avoid Security by Obscurity**: The security of a mechanism should not depend on the secrecy of its design or implementation. It should only depend on the secrecy of the keys.
9. **Simplicity (Economy of Mechanism)**: Keep security mechanisms simple and reliable. Complexity introduces vulnerabilities and makes auditing harder.
10. **Root Cause Correction**: When a vulnerability is found, fix the root cause rather than applying superficial patches. Address the systemic issue to prevent recurrence.
