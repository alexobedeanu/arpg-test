# Game Data (incremental)

This folder contains **data-driven content** for the ARPG prototype.

Design goals (initial pass):
- Keep IDs stable and human-readable.
- Prefer small, composable JSON files.
- Reference-by-id everywhere (no deep nesting that couples systems).

Proposed load order:
1. `affixes/*.json`
2. `items/*.json`
3. `skills/*.json`
4. `classes/*.json`
5. `loot/*.json`

All numbers are intentionally small and easy to tune.
