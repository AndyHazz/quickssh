# QuickSSH Test Coverage Analysis

## Current State

**The codebase currently has zero automated tests.** There are no test files, no test
framework configuration, no CI/CD pipelines, and no coverage tooling. This analysis
identifies the highest-value areas where tests should be introduced, ordered by risk
and impact.

---

## Priority 1 — SSH Config Parser (`sshconfig.js`)

**Risk: HIGH | Complexity: HIGH | Testability: EXCELLENT**

`parseConfig()` (154 lines) is the single most critical function in the project. It is
a pure function — text in, structured data out — with no external dependencies, making
it the ideal first target for a test suite.

### What to test

| Scenario | Lines | Why it matters |
|----------|-------|----------------|
| **Basic host parsing** — `Host`, `HostName`, `User` | 86–141 | Core functionality; any regression breaks the entire widget |
| **Group directives** — `#GroupStart` / `#GroupEnd` | 32–57 | Groups organize the entire UI; a parsing error collapses/misplaces hosts |
| **Nested/sequential groups** — multiple `#GroupStart` without `#GroupEnd` | 34–43 | The parser implicitly closes the previous group; this should be verified |
| **Wildcard filtering** — `Host *`, `Host web-?` | 98–102 | Wildcards must be skipped to avoid catch-all entries polluting the list |
| **Multi-host lines** — `Host foo bar baz` | 98–127 | Each name should produce a separate host entry with shared properties |
| **Icon directive** — `#Icon server-database` | 60–64 | Icon should apply to the *next* Host block only, then reset |
| **MAC directive** — `#MAC aa:bb:cc:dd:ee:ff` | 67–71 | Must validate 17-char hex format; invalid MACs should be ignored |
| **Command directive** — multiple `#Command` lines | 74–78 | Commands accumulate into an array and reset after the next `Host` |
| **Pending state reset** — icon/MAC/commands after Host | 128–130 | Pending metadata must not leak to subsequent Host blocks |
| **Empty input** | 18–19 | Should return `{ groups: [] }` without errors |
| **Final host/group flush** — host at end of file with no trailing newline | 144–150 | The last entry must not be silently dropped |
| **Comments and blank lines** — mixed with directives | 81–83 | Should be ignored cleanly |
| **Case insensitivity** — `host`, `HOST`, `HostName`, `hostname` | 86, 136–139 | Regex uses `/i` flag; tests should verify this |
| **Whitespace tolerance** — leading/trailing spaces, tabs | 29 | `.trim()` is called; test with indented config blocks |

### Suggested test structure

```
tests/
  sshconfig.test.js     ← table-driven tests for parseConfig()
  fixtures/
    basic.sshconfig     ← minimal Host entry
    grouped.sshconfig   ← groups with #GroupStart/#GroupEnd
    complex.sshconfig   ← all directives combined
    wildcards.sshconfig ← wildcard-only hosts
    edgecases.sshconfig ← empty file, trailing newlines, etc.
```

### Edge cases to cover that the current code may not handle well

1. **`#MAC` with invalid format** (e.g., `#MAC zz:zz:zz:zz:zz:zz`) — the regex
   `[0-9A-Fa-f:]` would reject this, but it silently falls through to the generic
   comment handler. Tests should verify the MAC field stays empty.
2. **`Host` line with only wildcards** (e.g., `Host * ?server`) — should produce zero
   entries, not a host entry with an empty name.
3. **Directives appearing in wrong order** (e.g., `HostName` before any `Host`) —
   currently silently ignored because `currentHost` is null; should be tested.
4. **Very long config files** — performance test with 500+ hosts to ensure no
   stack/memory issues.

---

## Priority 2 — Avahi Discovery Parser (`main.qml:parseDiscoveredHosts`)

**Risk: HIGH | Complexity: MEDIUM | Testability: GOOD (needs extraction)**

`parseDiscoveredHosts()` (lines 193–227 of `main.qml`) parses semicolon-delimited
output from `avahi-browse -tpr _ssh._tcp`. This is fragile because the input format is
undocumented third-party CLI output.

### What to test

| Scenario | Why it matters |
|----------|----------------|
| **Standard avahi output** — `=;eth0;IPv4;hostname;_ssh._tcp;local;host.local;192.168.1.1;22` | Happy path |
| **IPv6 entries** — `fields[2] !== "IPv4"` filter | Must be skipped |
| **Duplicate addresses** — same IP from multiple interfaces | `seen` map should deduplicate |
| **Already-configured hosts** — address matches an existing `hostList` entry | Should be excluded |
| **Malformed lines** — fewer than 9 fields, missing `=` prefix | Must not throw |
| **Empty output** | Should return empty array |

### Recommendation

Extract `parseDiscoveredHosts` into `sshconfig.js` (or a new `discovery.js`) as a pure
function that takes `(output, existingHostnames)` as parameters. This makes it testable
without a QML runtime.

---

## Priority 3 — Time Formatting (`main.qml:formatTimeAgo`)

**Risk: MEDIUM | Complexity: LOW | Testability: GOOD (needs extraction)**

`formatTimeAgo()` (lines 102–113) converts timestamps to human-readable strings. It
has clear boundary conditions at 60 seconds, 60 minutes, and 24 hours.

### What to test

| Input (ms ago) | Expected output |
|----------------|-----------------|
| 0 | "just now" |
| 30000 (30s) | "just now" |
| 60000 (1 min) | "1 min ago" |
| 300000 (5 min) | "5 mins ago" |
| 3600000 (1 hr) | "1 hour ago" |
| 7200000 (2 hr) | "2 hours ago" |
| 86400000 (1 day) | "1 day ago" |
| 172800000 (2 days) | "2 days ago" |
| null / undefined / 0 / -1 | "" |

### Recommendation

Extract to a standalone JS utility module so it can be tested without i18n mocking.

---

## Priority 4 — Model Building (`FullRepresentation.qml:buildFilteredModel`)

**Risk: MEDIUM | Complexity: HIGH | Testability: MODERATE (needs extraction)**

`buildFilteredModel()` (lines 224–350 of `FullRepresentation.qml`) contains 126 lines
of business logic that constructs the final display model. It handles favorites,
recents, search filtering, group collapsing, offline hiding, and discovered hosts —
all in one function.

### What to test

| Scenario | Why it matters |
|----------|----------------|
| **Search filtering** — matches on host, hostname, and user fields | Core user-facing feature |
| **Favorite hosts** — pulled out of groups and shown first | Order matters for UX |
| **Recent hosts** — 24-hour window, sorted by most recent | Time boundary must be exact |
| **Group collapsing** — collapsed groups show header only | Items must not leak through |
| **Offline hiding** — `hideUnreachable` hides non-online hosts | Filter must respect all statuses |
| **Discovered hosts** — appended at end, excluded if already configured | Deduplication logic |
| **Combined filters** — search + favorites + collapsed + offline | Interactions between filters |

### Recommendation

Extract the pure logic into a JS module that takes structured inputs (hosts, favorites,
history, config flags, search text) and returns the model array. The QML file then
becomes a thin wrapper.

---

## Priority 5 — State Management Functions

**Risk: LOW-MEDIUM | Complexity: LOW | Testability: GOOD (needs extraction)**

Several small functions in `main.qml` manage toggle state and should be tested:

| Function | Lines | What to test |
|----------|-------|--------------|
| `toggleFavorite(host)` | 363–373 | Add, remove, idempotency, persistence format |
| `toggleGroup(groupName)` | 335–345 | Collapse, expand, persistence format |
| `isFavorite(host)` | 359–361 | Present vs. absent |
| `isGroupCollapsed(groupName)` | 347–349 | Present vs. absent |
| `recordConnection(hostAlias)` | 91–100 | Adds entry, overwrites previous timestamp |

These are all simple array/object manipulations that can be tested if extracted into
a utility module.

---

## Testing Infrastructure Recommendations

### 1. Test framework

Since the core logic is JavaScript, use **Node.js + a lightweight test runner**:

- **Vitest** or **Jest** for the test runner
- No QML runtime needed — extract pure functions into `.js` modules
- Tests run fast and can be added to CI immediately

### 2. Project structure

```
quickssh/
  package/
    contents/
      code/
        sshconfig.js         ← existing parser (already a pure module)
        discovery.js          ← NEW: extracted from main.qml
        timeformat.js         ← NEW: extracted from main.qml
        modelbuilder.js       ← NEW: extracted from FullRepresentation.qml
  tests/
    sshconfig.test.js
    discovery.test.js
    timeformat.test.js
    modelbuilder.test.js
    fixtures/
      *.sshconfig
  package.json               ← NEW: test dependencies + scripts
```

### 3. CI/CD

Add a GitHub Actions workflow:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm test
```

### 4. Coverage target

Start with the parser (`sshconfig.js`) which can immediately reach **100% line
coverage** since it is a single pure function. Aim for **80%+ coverage** across all
extracted JS modules within the first iteration.

---

## Summary

| Priority | Module | Risk | Effort | Testability |
|----------|--------|------|--------|-------------|
| 1 | `parseConfig()` in sshconfig.js | HIGH | LOW | Excellent — already a pure function |
| 2 | `parseDiscoveredHosts()` in main.qml | HIGH | MEDIUM | Good — needs extraction |
| 3 | `formatTimeAgo()` in main.qml | MEDIUM | LOW | Good — needs extraction |
| 4 | `buildFilteredModel()` in FullRepresentation.qml | MEDIUM | HIGH | Moderate — needs extraction |
| 5 | State toggle functions in main.qml | LOW | LOW | Good — needs extraction |

The single highest-impact action is adding tests for `parseConfig()` — it is
already a standalone pure function, requires no refactoring, and protects the
most critical code path in the entire widget.
