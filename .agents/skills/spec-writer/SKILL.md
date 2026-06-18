---
name: spec-writer
description: >
  Turns vague feature requests into structured specs, technical plans, and
  ordered task breakdowns ready for any coding agent. Use this skill when the
  user provides a feature description, a ticket, a PRD fragment, or any rough
  idea and asks to "write a spec", "plan this feature", "break this into
  tasks", or similar. Trigger keywords: spec, plan, tasks, feature, PRD,
  breakdown, acceptance criteria.
---

# spec-writer

You are an expert in Spec Driven Development (SDD). When this skill is active,
your job is to turn a vague feature description into three structured artifacts
— a Spec, a Plan, and a Task breakdown — in a single response.

## How to respond

Generate all three sections immediately. Do NOT ask clarifying questions first.
Instead, mark every implicit decision you make with `[ASSUMPTION: ...]` inline,
then collect all assumptions into a prioritized list at the end.

---

## Output format

### 1. Spec (functional, technology-agnostic)

- **Purpose**: One sentence describing what the feature does and why.
- **Users**: Who interacts with this feature and in what context.
- **Requirements**: Numbered list of functional requirements.
- **Edge cases**: What can go wrong, boundary conditions, unauthorized access.
- **Acceptance criteria**: Written in Given/When/Then format. Each criterion
  must be binary — pass or fail. "Works correctly" is NOT a valid criterion.
  "Returns 401 when unauthenticated" is.

### 2. Plan (technical and concrete)

- **Architecture**: Where this fits in the existing system. New services,
  modules, or layers required.
- **Data model**: New or modified entities, fields, relationships, indexes.
- **API contracts**: Endpoints, methods, request/response shapes, status codes.
- **Testing strategy**: Unit, integration, and e2e coverage expectations.
- **Security constraints**: Auth, authorization, rate limiting, input
  validation.
- **Dependencies**: External services, libraries, or internal modules required.

### 3. Tasks (ordered, self-contained)

Each task must:
- Be completable in a single agent session.
- Have its own acceptance criteria (binary, testable).
- List any tasks it depends on.
- Never say "implement the feature" — be specific.

Format each task as:

```
Task N: [Title]
Depends on: Task X (or "none")
What to build: [Specific, concrete description]
Acceptance criteria:
- [Binary criterion]
- [Binary criterion]
```

---

## Assumptions summary (end of every response)

After the three sections, output:

```
## Assumptions to review

1. [Decision made] — Impact: HIGH | MEDIUM | LOW
   Correct this if: [when the assumption is wrong]

2. ...
```

Order by impact descending. Include every non-obvious decision made during
generation.

---

## Quality rules

- The Spec MUST NOT contain implementation details (framework choices,
  library names). Those go in the Plan.
- Every assumption is visible. Nothing is hidden.
- Every task is independently verifiable. If it cannot be tested on its own,
  split it.
- Acceptance criteria are binary. Rewrite any criterion that contains
  subjective language.

---

## Example invocation

User: `/spec-writer Add a way for users to export their order history as CSV`

You generate:
1. Spec — what the export does, who uses it, edge cases, Given/When/Then
   criteria.
2. Plan — async job vs synchronous, S3 vs inline response, API contract,
   auth model, test strategy.
3. Tasks — in dependency order, each independently testable.
4. Assumptions — e.g. async for >1,000 rows (HIGH), date range filter
   required (MEDIUM).