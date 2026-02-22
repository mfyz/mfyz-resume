# mfyz-resume — Plan

## What This Is

A monorepo with two packages sharing a single `resume.yaml`:

1. **`mfyz`** (npm package) — Zero-dependency interactive CLI resume
2. **`resume-builder`** (private) — PDF/HTML generation using yamlresume

## Architecture

```
mfyz-resume/
├── resume.yaml              ← Shared source of truth
├── packages/
│   ├── cli/                 ← "mfyz" on npm
│   │   ├── package.json     ← name: "mfyz", zero deps
│   │   ├── cli.js           ← Single file, Node builtins only
│   │   └── resume.yaml      ← Copied at build/prepublish
│   └── builder/             ← Private, not published
│       ├── package.json     ← yamlresume, personal tooling
│       ├── yamlresume.yaml  ← yamlresume config
│       ├── variants/        ← Variant configs
│       └── output/          ← Generated PDFs (gitignored)
└── package.json             ← Workspace root
```

### Why monorepo?

- `resume.yaml` lives at root — single source of truth
- CLI package stays tiny (copied yaml + 1 JS file)
- Builder package has heavy deps (yamlresume, LaTeX)
- Clean publish boundary: only `packages/cli/` goes to npm

## Package 1: `mfyz` (Interactive CLI)

### Constraint: Zero Dependencies

Published package contains only:
- `cli.js` — single entry file
- `resume.yaml` — bundled data (copied from root at prepublish)

No Inquirer, no Chalk, no dependencies at all. Uses:
- `readline` (Node built-in) — keyboard input, arrow key navigation
- ANSI escape codes — colors, bold, box drawing
- `fs` + yaml parsing — simple hand-rolled parser (resume.yaml is predictable structure, no need for a full YAML lib)

### How it works

```
$ npx mfyz

  ╭──────────────────────────────╮
  │  Fatih Felix Yildiz          │
  │  Principal Technical PM      │
  │  fatih@mfyz.com              │
  ╰──────────────────────────────╯

  → Experience
    Skills
    Education
    Projects
    Contact
    Exit

  ↑↓ navigate  ↵ select  q quit
```

Arrow keys move selection, Enter shows section content, Back returns to menu.

### YAML parsing without deps

Our `resume.yaml` is structurally predictable — no anchors, no flow sequences in weird places. A ~50 line parser handles:
- Key-value pairs
- Lists (dash items)
- Nested objects (indentation)
- Multi-line strings

If this gets fragile, fallback: bundle `js-yaml` as a vendored single file (~30KB).

### package.json (cli)

```json
{
  "name": "mfyz",
  "version": "1.0.0",
  "description": "Fatih Felix Yildiz — interactive resume",
  "bin": { "mfyz": "./cli.js" },
  "files": ["cli.js", "resume.yaml"],
  "scripts": {
    "prepublishOnly": "cp ../../resume.yaml ."
  }
}
```

### Install size goal

Target: **< 50KB** total published package. For comparison:
- Most CLI resume packages: 5-50MB (Inquirer + Chalk tree)
- Ours: resume.yaml (~3KB) + cli.js (~5-10KB)

## Package 2: `resume-builder` (Private)

### Uses yamlresume

No need to reinvent PDF generation. yamlresume provides:
- ✅ YAML schema validation (`yamlresume validate`)
- ✅ PDF generation with LaTeX typesetting (`yamlresume build`)
- ✅ HTML + Markdown output
- ✅ Watch/dev mode (`yamlresume dev`)
- ✅ JSON Resume interop (`json2yamlresume`)
- ✅ Multiple templates (moderncv variants)

### yamlresume schema compatibility

Our `resume.yaml` should follow yamlresume's expected format so `yamlresume build` works directly. Key difference from our earlier draft:

```yaml
content:
  basics:
    name: Fatih Felix Yildiz
    label: Principal Technical PM
    email: fatih@mfyz.com
    # ... yamlresume schema
  experience:
    - company: ArcXP
      role: Principal Technical PM
      # ...
layouts:
  - engine: latex
    template: moderncv-banking
```

Need to verify: does yamlresume's schema support extra fields (like our `tags`, `variants`) or will validation fail? If strict, we keep variant config in `packages/builder/variants/` separately.

### Variant generation

```bash
# In packages/builder/
yamlresume build ../../resume.yaml          # Default
yamlresume build variants/ic.yaml           # IC variant (extends base)
yamlresume build variants/leadership.yaml   # Leadership variant
```

Variant files could import/override sections from the base resume.

### Commands (from repo root)

```bash
npm run build          # Build all PDF variants
npm run validate       # Validate resume.yaml against schema
npm run dev            # Watch mode
```

## resume.yaml Schema

Follow yamlresume format for builder compatibility. CLI parses the same file.

```yaml
content:
  basics:
    name: Fatih Felix Yildiz
    label: Principal Technical PM / Full-Stack Engineer
    email: fatih@mfyz.com
    url: https://mfyz.com
    location:
      city: New York
      region: NY
    profiles:
      - network: GitHub
        username: mfyz
        url: https://github.com/mfyz
      - network: LinkedIn
        username: mfyz
        url: https://linkedin.com/in/mfyz

  experience:
    - company: ArcXP (The Washington Post)
      role: Principal Technical PM
      start: 2021-03
      highlights:
        - Led platform serving 2000+ newsrooms
        - Drove API modernization and DX

    - company: PanelOne
      role: Co-Founder & CTO
      start: 2023-06
      highlights:
        - Built Shopify analytics platform

  skills:
    - category: Languages & Frameworks
      items: [TypeScript, React, Next.js, Node.js]
    - category: Infrastructure
      items: [AWS, Docker, CI/CD]
    - category: Product
      items: [Roadmapping, Stakeholder Mgmt]

  education:
    - institution: University Name
      degree: BS Computer Science
      year: 2009

  projects:
    - name: mfyz.com
      description: Personal tech blog (15+ years)
      url: https://mfyz.com

layouts:
  - engine: latex
    template: moderncv-banking
  - engine: html
    template: calm
```

## Decisions Made

| Decision              | Choice                       | Rationale                      |
|-----------------------|------------------------------|--------------------------------|
| npm name              | `mfyz` (available ✅)         | Short, personal brand          |
| CLI deps              | Zero                         | Tiny install, fast npx         |
| PDF generation        | yamlresume (defer details)   | Don't reinvent, good enough    |
| YAML schema           | yamlresume-compatible        | Builder works out of the box   |
| Repo structure        | Monorepo, 2 packages         | Share resume.yaml cleanly      |

## Implementation Order

```
Step 1: Init monorepo, workspace config, resume.yaml
Step 2: Build zero-dep CLI (cli.js) — get npx mfyz working
Step 3: Publish mfyz to npm
Step 4: Set up builder package with yamlresume
Step 5: Generate first PDF variants
Step 6: Variant system (separate configs or schema extension)
Step 7: README + polish
```

## Open Questions

- [x] npm name → `mfyz` (available, Fatih has npmjs account)
- [ ] yamlresume schema strictness — does it reject extra fields?
      If yes, keep variant metadata separate from resume.yaml
- [ ] YAML parsing in CLI — hand-roll vs vendor js-yaml?
      Start hand-rolled, fallback to vendored if fragile
- [ ] How fancy should the CLI output be?
      Colors yes, animations probably no, box-drawing for header
- [ ] Host HTML version at resume.mfyz.com?
- [ ] Variant strategy — yamlresume overlay files vs custom merge?
