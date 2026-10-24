# Cove

A full-stack car dealership inventory system built as a TDD kata: a REST API on PostgreSQL with
JWT auth and admin/user roles, and a React + Tailwind single-page app on top.

> Status: Phase 1 (foundation). Sections marked TODO are filled in as the phases complete.
> "Purchase" is a simulated inventory action. There are no real payments and no real cars; seed
> prices are demo data.

## Local setup (backend)

Prerequisites: Node.js 22.13 or newer, PostgreSQL 16 with two empty databases (`cove_dev`, `cove_test`).

```bash
npm run setup                      # install backend dependencies, generate the Prisma client
cp backend/.env.example backend/.env   # then edit the connection strings
npm --prefix backend run db:migrate    # apply migrations to cove_dev
npm run dev                        # API on http://localhost:3000
npm test                           # migrates cove_test, then runs the suite
```

The test database name must end in `_test`; the suite refuses to run otherwise.

## Features mapped to the kata

TODO: requirement checklist table (Phase 6).

## Architecture

TODO: Mermaid diagram and ADR links (Phase 6).

## Test report

TODO: real numbers from real runs (Phase 6).

## My AI Usage

TODO(me): write this section in your own words. Cover:

- Which AI tools I used.
- How I used each one, with concrete examples from this repo.
- What I verified or rewrote by hand.
- Where the AI was wrong and how I caught it.
- My reflection on how AI changed my workflow.

## Known limitations

TODO: honest list (Phase 6).
