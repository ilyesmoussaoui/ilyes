---
name: plan
description: |
  Architecture planning only. Creates PLAN.md from a spec file without executing.
  Triggers: "plan the project", "create a plan", "architecture plan"
argument-hint: "[path/to/SPEC.md]"
user-invocable: true
disable-model-invocation: false
effort: high
---

# Architecture Planning

Read the spec file at `$ARGUMENTS`. If no path given, find `SPEC.md` in the current directory.

Create `PLAN.md` with the following sections:

## 1. Executive Summary
What we're building and why. One paragraph.

## 2. Architecture Overview
System diagram (describe in text), data flow, component hierarchy, service boundaries.

## 3. Tech Stack
Every technology choice with a one-line justification. Research with Context7 and Brave Search for latest versions and best practices.

## 4. Data Models
Full schema: tables, columns, types, relationships, indexes, constraints. Include an ER diagram in text.

## 5. API Contracts
Every endpoint:
```
METHOD /path
Auth: required | public
Body: { schema }
Response 200: { schema }
Response 4xx: { error }
```

## 6. Component Tree
Every frontend component: name, props, state, data dependencies, children.

## 7. Task Breakdown
Ordered tasks assigned to agent roles. Each task:
- What to build (specific)
- Which files to create/modify
- Verification criteria (how to confirm it's done)
- Dependencies (which tasks must complete first)
- Estimated size: small (2-5 min) / medium (5-10 min) / large (split further)

## 8. Deployment Strategy
How this ships: hosting, CI/CD, environment setup, monitoring.

## 9. Risk Assessment
What could go wrong. Mitigation for each risk.

Present the plan for review. Do NOT start building.
