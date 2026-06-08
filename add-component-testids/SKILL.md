---
name: add-component-testids
description: Use when adding missing testIDs to a React Native module's interactive/scrollable/text components in bmb.core or nbg-ui-library - scans a folder, follows existing naming, adds props (library) or BEM literals (app); never hallucinates
---

# Add Component testIDs

Forward/proactive companion to `appium-testid-migration`. Given a **module folder**, scan its
components and add missing testIDs to interactive, scrollable, and text-label nodes. **Never
hallucinate** a name or a forwarding path: derive from concrete evidence, else placeholder/skip.
**Never create a duplicate testID value** that can render on the same screen as another (see "Uniqueness").

## When to use

User names a target module (a folder). The skill detects the repo from the path and switches rules:

| Repo (path contains) | Rule |
|---|---|
| `nbg-ui-library` | **Props only — never a literal.** Add granular `*TestID?: string` props, forward each to its node. |
| `bmb.core` | **Concrete BEM literals** `screen__elementType--name` at own nodes, or passed via a library component's `*TestID` prop at the call site. |

## Target nodes

Interactive + scrollable + text labels (decorative `View`/`Image` skipped). The exact set is
`TARGET_NODES` in `lib/scan-jsx.mjs`, derived from the shared `ELEMENT_TYPES` map:
`Pressable/Button → button`, `Touchable* → touchable`, `ScrollView → scrollView`,
`FlatList/SectionList → flatList`, `TextInput → textInput`, `Text/CustomText → text`, `Switch → switch`.

## Procedure (apply directly + report)

1. **Scan.** `node bin/scan-module.mjs <moduleDir>` → JSON of untagged target nodes (file, line, tag,
   elementType) + a human summary. Nodes that already carry a `testID`/`*TestID` are not listed (idempotent).
2. **Per candidate, read the component** and confirm the real target node and (library) the forwarding
   path. The scanner is a heuristic flag, not the source of truth — confirm before editing.
3. **Apply the per-repo edit** (below). Before committing to a `name`, make sure the resulting value is
   **unique** (see "Uniqueness") — if the same value already exists, qualify it (see below).
4. **Check duplicates.** `node bin/check-duplicates.mjs <moduleDir>` → every testID value that appears on
   more than one node, with `[SAME FILE]` flagged. Resolve every genuine same-screen collision you
   introduced; record the renames in the report.
5. **Report** to `docs/superpowers/testids/<module>-report.md` (template below).

Re-running on the same module only touches still-untagged nodes.

## nbg-ui-library edit rule (props, never literals)

- Add a **granular** `*TestID?: string` prop per targetable node to the component's props type, and
  forward it to that node. Prop name = `${role}TestID` (`pressableTestID`, `labelTestID`, `iconTestID`,
  `switchTestID`, `scrollViewTestID`, `textInputTestID`, `buttonTextTestID`, …).
- If the node is itself a **library child component** exposing a `*TestID` prop, forward through it.
- For `.map()` lists, forward then suffix by a stable key: `` testID={`${rowTestID}-${item.id}`} ``.
- **Never** add a literal value here. If a prop's path to a real native node can't be confirmed,
  **skip + report** — never add a dangling prop.

## bmb.core edit rule (concrete BEM literals)

- Emit `screen__elementType--name`:
  - **screen** — from the package/file (`packages/login/...` → `login`).
  - **elementType** — from the node via `elementTypeFor` (use `lib/bem.mjs` `buildBemTestId`).
  - **name** — derived per the no-hallucinate rule.
- If the node is a **library component** exposing a `*TestID` prop → pass the literal at the **call site**
  via that prop. If it is a **bmb.core-owned native node** → add `testID={'...'}` directly.

## No-hallucinate naming (bmb.core `name` segment)

Derive `name` only from concrete in-file evidence, in priority order:
1. explicit `label`/`title`/`placeholder` prop value on the node;
2. an i18n key referenced on/near the node;
3. the `onPress`/handler function name;
4. the variable/component identifier rendering the node.

If none is defensible → emit `screen__elementType--TODO_RENAME` and list it under "Placeholders to
rename". If the true target node (or, in the library, the forwarding path) can't be confirmed →
**skip + report**. Never invent a descriptive word.

## Uniqueness (no duplicate testIDs)

A testID is only useful if it locates **one** node. Be extra careful: deriving names from i18n keys or
generic labels makes collisions easy (the same `availableBalanceLabel` / `back` / `title` text recurs in
many components). Before and after editing, ensure no two nodes that can be on screen together share a value.

- **`.map()` / repeated nodes** — always suffix with a stable per-item key
  (`` `${screen}__text--row-${item.id}` ``). Never emit the same static literal inside a loop.
- **Two targetable nodes in the same JSX block** — give each a distinct `name` (e.g. a Pressable and the
  CustomText it wraps → `--editButton` vs `--editLabel`, not both `--edit`).
- **Same label in sibling sections of one screen** — qualify by section/component identifier
  (`--loadingAvailableBalanceLabel`, `--widgetPinnedTitle`), don't reuse the bare i18n-derived name.
- **Acceptable (not real) collisions — leave as-is:** mutually-exclusive branches (mobile/web, RETAIL/BMB,
  loading/loaded, if/else), single-open bottom sheets/modals (only one mounts at a time), genuinely
  different screens, and template literals whose `${…}` suffix makes them unique at runtime. The duplicate
  checker flags these too (it can't see render conditions) — use judgment, and note why each is safe.
- Resolve a collision by **adding qualifying context to the `name` segment** (still derived from in-file
  evidence: the component identifier, the section, or the state). Never disambiguate by changing `screen`
  or `elementType` away from what `buildBemTestId` dictates.

`bin/check-duplicates.mjs` exits non-zero when a **same-file** collision exists; treat any `[SAME FILE]`
entry you introduced as something to fix unless the two nodes are provably in mutually-exclusive branches.

## Report template

`docs/superpowers/testids/<module>-report.md`:

```markdown
# testID additions — <module>

Repo: <repo> · rule: <props|literal>
Scanned: <N> files · tagged <M> nodes · placeholders <P> · skipped <S>

## Added
| file:line | node | prop / literal | source |
|---|---|---|---|
| .../Foo.tsx:42 | Pressable | testID 'moneybox__button--edit' | handler onEditButtonPress |

## Placeholders to rename
- .../Bar.tsx:88 — `moneybox__button--TODO_RENAME` (no defensible name)

## Skipped / uncertain
- .../Baz.tsx:21 — forwarding path to native node not confirmed

## Duplicate-value audit
- Renamed to resolve same-screen collisions: `moneybox__text--amount` → `--loadingAmount` (.../Skeleton.tsx)
- Remaining duplicate literals are safe (mutually-exclusive branches / single-open sheets / template suffixes)
```

## Tools

- `bin/scan-module.mjs <moduleDir>` — list untagged target nodes (JSON + summary).
- `bin/check-duplicates.mjs <moduleDir>` — list testID values used on >1 node (`[SAME FILE]` flagged);
  exits non-zero on a same-file collision. Run after editing.
- `lib/scan-jsx.mjs` — `scanSource`, `scanModule`, `detectRepo`, `TARGET_NODES`, `hasTestIdAttr`,
  `collectTestIds` (extract testID values: static/template/dynamic), `findDuplicateTestIds`.
- Reused: `../appium-testid-migration/lib/bem.mjs` (`buildBemTestId`, `elementTypeFor`) and
  `../appium-testid-migration/lib/testid-index.mjs` (`walk`, `findTestIdLiteral`).

Run tests with the glob form (Windows + Node v24 errors on a bare directory):
`node --test lib/*.test.mjs`.

## Verification (static, no app run)

- Re-run `scan-module.mjs` → 0 untagged target nodes except those explicitly reported as skipped.
- Run `check-duplicates.mjs` → every `[SAME FILE]` entry is either pre-existing or a mutually-exclusive
  branch; no same-screen collision you introduced remains. Cross-file duplicates are accounted for in the report.
- Grep nbg-ui-library changes → **no testID literals introduced** in that repo.
- nbg-ui-library still type-checks (`tsc`) — new props are on the components' props types.
- Report enumerates every placeholder and skip.

## Hard rules

- Never run git. The user commits.
- Never hardcode a testID literal in nbg-ui-library.
- **Never introduce a duplicate testID value** that can be on screen with its twin. Suffix `.map()` items,
  qualify same-label siblings, and run `check-duplicates.mjs` before reporting. (See "Uniqueness".)
- Idempotent/re-runnable; only untagged target nodes are touched.
- When the node, the name, or the forwarding path can't be confirmed → skip/placeholder + report.
  Coverage is secondary to correctness.
