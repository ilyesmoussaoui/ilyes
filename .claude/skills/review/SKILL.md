---
name: review
description: |
  Full code quality + security + test audit on the current codebase.
  Triggers: "review the code", "audit the code", "check code quality"
user-invocable: true
disable-model-invocation: false
effort: max
---

# Full Codebase Audit

Run three parallel review agents on the current codebase:

## Agent 1: Code Quality (spawn `code-reviewer`)
- Architecture: clean, modular, proper separation of concerns
- DRY / SOLID compliance
- No god objects, no spaghetti, no copy-paste
- Performance: N+1 queries, unnecessary re-renders, bundle size
- TypeScript strictness
- Error handling at system boundaries

## Agent 2: Security (spawn `security-auditor`)
- OWASP Top 10 compliance
- Injection vectors (SQL, XSS, CSRF, command)
- Auth/authz checks on all protected routes
- Secrets exposure scan
- Dependency vulnerabilities (`npm audit`)
- Security headers (CORS, CSP, HSTS)

## Agent 3: Test Coverage (spawn `qa-engineer`)
- Identify untested critical paths
- Evaluate test quality (meaningful assertions, not just coverage%)
- Check e2e coverage of user flows
- Flag flaky or meaningless tests

## Output
Unified report:
```
CATEGORY          VERDICT    ISSUES
Code Quality      PASS/FAIL  X critical, Y warnings
Security          PASS/FAIL  X critical, Y warnings
Test Coverage     PASS/FAIL  X untested paths
```

For each issue:
```
[SEVERITY] file:line — description
  Fix: exact change needed
```

If any category is FAIL, create fix tasks and execute them automatically.
