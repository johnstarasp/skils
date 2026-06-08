---
name: appium-testid-migration
description: Use when migrating NBGAutomation Appium locators to stable testIDs across bmb.core and nbg-ui-library - codifies the no-guess Resolve-then-Apply process, BEM naming, and platform mapping rules
---

# Appium → testID Migration

Migrate fragile Appium locators to stable testIDs. Resolve first (read-only), apply second.
**Never guess.** If a locator's component cannot be uniquely confirmed, mark it `UNRESOLVED`.

## Platform mapping (why testIDs work)

- React Native `testID` → Android native `resource-id`; iOS native `accessibilityIdentifier`.
- Appium Android: `@AndroidFindBy(xpath="//*[@resource-id='<id>']")`.
- Appium iOS: `@iOSXCUITFindBy(xpath="//*[@name='<id>']")`. The XCUITest `name` attribute resolves to
  `accessibilityIdentifier` **first**, falling back to `accessibilityLabel`. So a `@name='<visible
  text>'` locator is matching the *label* (fragile) and must be re-pointed to the testID.
- A `testID` has no effect until forwarded to a real native node (`View`/`Pressable`/`ScrollView`).

## testID convention (BEM)

`screen__elementType--name`, e.g. `login__textInput--username`, `newTransfer__button--next`.
Use `lib/bem.mjs` (`buildBemTestId`, `isValidBemTestId`, `elementTypeFor`). `elementType` reflects the
true interactive node (button, touchable, scrollView, flatList, textInput, text, switch, image).

## Verdicts (resolution decision tree)

For each locator record, assign exactly one:

| Verdict | Condition | Apply action |
|---|---|---|
| `MATCHED_EXISTING` | references an id confirmed as a `testID=` literal (bmb.core/nbg-ui-library) via `findTestIdLiteral` | rewrite both platforms to that id |
| `DRIFT` | references a testID-style id that does NOT exist anywhere | report only; no edit |
| `NEEDS_TESTID` | component found **uniquely** AND the interactive node + testID path confirmed by reading the component | add testID per placement; rewrite locators |
| `NO_COMPONENT` | native/OS element (system keyboard, OS dialog, legacy `mbanking.NBG:id/AP_*`) | leave as-is; report as intentionally skipped |
| `UNRESOLVED` | ambiguous (e.g. visible text maps to multiple packages), not found, or interactive node unconfirmed | **skip + report** with best-evidence candidates |

Reaching `NEEDS_TESTID` REQUIRES opening the candidate component file and confirming where the testID
prop lands. If you cannot confirm forwarding to a native node, use `placement: LIBRARY` (add the
forward) or downgrade to `UNRESOLVED`.

## Placement (where the testID goes) — for NEEDS_TESTID

| placement | When | Action |
|---|---|---|
| `CALLSITE` | rendering component already forwards `testID` to its interactive node (verified by reading it) | add `testID={'<bem>'}` at the bmb.core usage site only |
| `OWN_COMPONENT` | element is a bmb.core-owned node | add `testID` directly at the interactive node in bmb.core |
| `LIBRARY` | a nbg-ui-library component does NOT forward `testID` to its interactive node | nbg-ui-library: add a `testID?: string` prop and forward it to the interactive node — **NEVER a literal value**; bmb.core: pass the concrete BEM value at the call site |

## Matching evidence chain (no-guess rules)

1. **testID-style locator** → `findTestIdLiteral(id, roots)`. A testID counts as existing whether it is
   written as a raw `testID="id"` OR forwarded through a testID-style prop (`inputTestID={'id'}`,
   `iconTestID="id"`, `buttonFooterTestID`, `labelTestID`, etc.) — `findTestIdLiteral` matches all of
   these. Found → `MATCHED_EXISTING` (record the file:line you confirmed). Absent → `DRIFT`.
2. **Visible text** (`evidence.visibleText`) → search `bmb.core/packages/*/i18n/locales/*.js` for the
   string value → get the translation key → grep components in the **same domain package** for that
   key → if exactly one interactive component uses it, read it and proceed to `NEEDS_TESTID`; if the
   string/key appears in multiple packages or components (e.g. "Accept & continue" → 3fa, wizardsFactory,
   login), mark `UNRESOLVED`.
3. **content-desc / widget / index** → use the Java field name + nearby method names + the screen's
   domain to locate the component. Unique match → `NEEDS_TESTID`; otherwise `UNRESOLVED`.
4. **Parameterized testID** (`wizardsFactory__switch--${name}`) → Java must use
   `contains(@resource-id,'<prefix>')` / `contains(@name,'<prefix>')`, or a resolved concrete value.
   If the concrete value isn't determinable from Java context → `UNRESOLVED`.
5. **One confirmed testID wins — THE CORE MIGRATION FIX (apply before declaring any mismatch).**
   If EITHER platform's locator references a testID that you confirm exists on the **correct
   interactive/target node** (as a `testID=` literal or forwarded `*TestID` prop), set
   `verdict: MATCHED_EXISTING`, `testId` = that id, and plan to rewrite **BOTH** platform locators to
   it — **even if the other platform's current locator is broken, fragile, points at a different/wrong
   element, or is copy-paste junk.** Rationale: a React Native `testID` is *simultaneously* the Android
   `resource-id` and the iOS `accessibilityIdentifier` of the **same node**, so the confirmed id is
   guaranteed to address the same element on both platforms. A broken locator on the other platform is
   the bug being fixed, not a blocker. (This covers the common case where iOS locators are copy-paste
   junk while Android already uses a real testID — and the symmetric case.)
   - **Only** when the confirmed testID is on the ACTUAL interactive/target node. If the only confirmed
     testID sits on a **child** (e.g. an icon inside a tab `Pressable`) rather than the node Appium must
     act on, do NOT treat it as MATCHED_EXISTING — use `NEEDS_TESTID` (add a testID to the interactive
     node) or `UNRESOLVED`.
6. **Genuine mismatch → UNRESOLVED** only when **neither** platform references a confirmed testID on the
   correct node (e.g. Android → an OS-generated label, iOS → a different OS label, no app testID
   anywhere), OR when it is ambiguous which testID/element is correct. Note each platform's candidate.

**Grep scoping (Windows performance):** searching the whole `packages/` tree can time out. Always scope
to the screen's **domain package first** (e.g. `packages/login`), then broaden only if nothing is found.

## Record schema (per locator)

```json
{
  "fieldName": "usernameInputFill",
  "android": { "strategy": "...", "raw": "<xpath>", "hasIndex": false },
  "ios":     { "strategy": "...", "raw": "<xpath>", "hasIndex": false },
  "evidence": { "visibleText": "...", "contentDesc": "...", "widgetType": "..." },
  "verdict": "MATCHED_EXISTING|DRIFT|NEEDS_TESTID|NO_COMPONENT|UNRESOLVED",
  "testId": "login__textInput--username",
  "placement": "CALLSITE|OWN_COMPONENT|LIBRARY",
  "targetNode": "Pressable|ScrollView|FlatList|TextInput|...",
  "bmbProof": "packages/<domain>/.../File.tsx:142",
  "proposedName": "login__textInput--username",
  "reason": "<why skipped / how matched>"
}
```

## Tools

- `lib/parse-locators.mjs` — `parseLocators(javaText)` → records (android/ios/evidence).
- `lib/testid-index.mjs` — `findTestIdLiteral(id, roots)` → `["file:line", ...]`; `walk(dir, exts)`.
- `lib/bem.mjs` — `buildBemTestId`, `isValidBemTestId`, `elementTypeFor`.
- `lib/manifest.mjs` — `mergeFragments`, `collisionCheck`, `summarize`, `toReviewMarkdown`.
- `bin/extract-screen.mjs` — `node bin/extract-screen.mjs <java> [outDir]` → fragment JSON.
- `bin/verify-references.mjs` — `node bin/verify-references.mjs <appiumDir> <srcRoot...>` → missing-id report.

Run tests with the glob form (Windows + Node v24 errors on a bare directory):
`node --test lib/*.test.mjs`.

## Pipeline

1. **Inventory** — run `extract-screen.mjs` over all 40 screens → fragments with `verdict:"PENDING"`.
2. **Resolve** — one read-only agent per screen fills verdicts following the decision tree above.
3. **Merge + review** — `manifest.mjs` builds the master manifest + `REVIEW.md`; collisions must be 0.
   **Human reviews `REVIEW.md` before any edit.**
4. **Apply (in order):** nbg-ui-library (forward props) → bmb.core (call sites/own) → NBGAutomation
   (rewrite both platform locators).
5. **Verify** — `verify-references.mjs` + `mvn test-compile`.

## Hard rules

- Never run git. The user commits.
- Never hardcode a testID literal in nbg-ui-library.
- Both `@AndroidFindBy` and `@iOSXCUITFindBy` are updated together to the same id.
- When in doubt, `UNRESOLVED`. Coverage is secondary to correctness.
