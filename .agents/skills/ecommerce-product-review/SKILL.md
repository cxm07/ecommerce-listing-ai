---
name: ecommerce-product-review
description: Create a human product-review checklist from structured Product, SKU, Issue, and summary data. Use for reviewing data quality and evidence before product approval; do not use to parse Excel, edit facts, resolve issues, approve a task, export, or publish.
---

# Product review

Read `references/contracts.md`. Classify supplied issues into blocking errors, warnings, and information. Cite supplied source references, identify missing evidence, and recommend human actions. Return the output schema exactly. Always set `needs_human_review` to true. Do not invent facts, mutate input, resolve issues, or change task state.
