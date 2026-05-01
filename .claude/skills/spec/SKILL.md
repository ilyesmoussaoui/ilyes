---
name: spec
description: |
  Creates a project spec file from a conversation. Asks questions to understand what the user wants to build, then generates a comprehensive SPEC.md.
  Triggers: "create a spec", "write a spec", "help me spec out", "new project"
argument-hint: "[project-name]"
user-invocable: true
disable-model-invocation: false
---

# Spec Creation Assistant

Help the user create a comprehensive `SPEC.md` for their project.

## Process
1. Ask focused questions to understand:
   - What they're building and for whom
   - Core features (prioritized: must-have vs nice-to-have)
   - Pages/screens and what each contains
   - User roles and access control
   - Data entities and relationships
   - Integrations (auth, payments, APIs, etc.)
   - Design preferences (style, colors, inspiration)
   - Tech preferences (or use defaults)
   - Deployment target

2. Generate `SPEC.md` in the current directory with all gathered information structured as:
   - Project Name & Vision
   - Core Features (numbered, detailed)
   - Pages / Screens
   - User Roles & Auth
   - Data Models
   - API Requirements
   - Design Preferences
   - Tech Stack
   - Constraints

3. Ask the user to review. Iterate until they approve.

After approval, suggest: "Run `/build` to start the autonomous pipeline."
