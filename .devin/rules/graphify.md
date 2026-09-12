---
description: "Query the graphify knowledge graph first on every new task"
trigger: always_on
---

# Graphify first

This repo has a graphify knowledge graph at `graphify-out/`. At the start of every task, query it for context BEFORE any other codebase exploration (grep, glob, broad file reads).

- First step: `graphify query "<question about the task>"` — returns a scoped subgraph of relevant code.
- `graphify path "<A>" "<B>"` for relationships between components.
- `graphify explain "<concept>"` for a focused concept.
- If `graphify-out/wiki/index.md` exists, use it for broad navigation.
- Read `graphify-out/GRAPH_REPORT.md` only when query/path/explain don't surface enough.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

Skip this rule only if graphify is not installed or `graphify-out/graph.json` is absent.
