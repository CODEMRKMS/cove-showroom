# CLAUDE.md — Project rules (Car Dealership Inventory System, TDD Kata)

Source of truth: `KATA.md` (the official kata) wins over `MASTER_PROMPT.md`. If they conflict, follow KATA.md and tell the user about the conflict.

## Priorities (outrank everything else)

1. **Kata requirements are graded first.** Real PostgreSQL, JWT auth, every listed endpoint, admin-only rules, TDD commit history, React + Tailwind + HTML5 + CSS3, search/filter, Purchase disabled at zero stock, admin CRUD UI, README with screenshots, test report, "My AI Usage", PROMPTS.md. If time runs short, cut polish, never requirements.
2. **Never fabricate.** No fake reviews, statistics, awards, test results, coverage numbers or screenshots. Every number in the README comes from a real run.
3. **No plagiarism.** Write everything from scratch. No copied repos, templates or downloaded 3D models. Every external asset (fonts, icons) is open-licensed and listed in `CREDITS.md`.
4. **The user must be able to explain every line.** After each phase: a plain-language walkthrough (max 15 lines) plus 3 likely interview questions with short answers.
5. **Be honest about trade-offs.** Never claim a check passed without running it. Report what is not done.

## Scope for this deadline

- Deadline: 3 pm IST, 25 Oct 2026.
- Order: Phases 1, 2, 3, 4, 6 on `main`. Cars render as SVG 2.5D illustrations from `buildCarSpec`.
- Phase 5 (3D studio) is **optional and last**: start it only after Phases 1-4 and 6 are fully green, on a separate branch (`feat/3d-studio`). Never add 3D dependencies to `main` before then. Merge without squash only if its gate passes; otherwise leave it unmerged.
- Phase 7 (deploy + e2e) is optional, only if time remains.
- Work one phase at a time. Stop at each gate and wait for "Gate passed. Execute Phase N."

## Git and TDD

- **Never run `git commit`.** Stage files, run checks, show the proposed message, wait. Exception: the user explicitly says "you may commit" / "commit it".
- **Never** use `/ship`, auto-commit, squash, amend, rebase of recorded history, or force push. History is evidence.
- Red / Green / Refactor as separate commits for every behaviour (from Phase 2 onward):
  1. `test(scope): <behaviour> [RED]`: test code only. Run it, show the failure, and confirm it fails for the right reason.
  2. `feat(scope): <behaviour> [GREEN]`: the smallest code that passes. Show the green run.
  3. `refactor(scope): <what improved>`: only when worthwhile; tests stay green.
- Conventional Commits, in the user's voice, short and specific. The body says what the AI did and what the user changed or verified.
- Every AI-assisted commit ends with two blank lines, then:
  `Co-authored-by: Claude <noreply@anthropic.com>`
- No pre-commit hook that runs tests (RED commits must go through). Lint/format hooks only if they pass on a failing-test commit. Test enforcement lives in CI.
- Small, frequent commits. Work on `main` or short-lived branches merged without squash.

## Dependencies

- Before installing, run `npm view <pkg> version` and pin **exact** versions. Prefer releases at least two weeks old. Official npm registry only. Commit the lockfile.

## AI disclosure

- `PROMPTS.md` holds the user's **raw, unedited** chat logs only. Never write summaries into it. Remind the user at the end of every phase to append that phase's raw chat.
- README "My AI Usage" is written by the user. Scaffold the prompts with `TODO(me)` markers. Never write the user's reflection.

## Engineering defaults

- Backend: `routes -> controllers -> services -> repositories`; services depend on repository interfaces; one composition root (`container.ts`); `createApp(deps)` factory.
- Tests run against a real PostgreSQL test database. No in-memory DB anywhere.
- Money stored as integer minor units. Role rules come from one policy map, not scattered `if`s.
