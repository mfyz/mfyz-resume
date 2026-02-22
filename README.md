# mfyz-resume

Personal resume toolkit — monorepo with two packages sharing a single `resume.yaml`.

## Packages

### `mfyz` (npm)

Interactive CLI resume. Run `npx mfyz` to see it in your terminal.

- Zero dependencies — Node builtins only
- Single JS file + bundled YAML data
- Published to npm as `mfyz`

**Status:** Not yet implemented

### `@mfyz/resume-generator` (private)

PDF/HTML/Markdown resume generation powered by [yamlresume](https://yamlresume.dev/).

- Validates `resume.yaml` against yamlresume schema
- Generates HTML (calm template) and Markdown
- PDF generation via LaTeX (requires xelatex or tectonic)

## Quick Start

```bash
# Install dependencies
npm install

# Validate resume data
npm run validate -w packages/generator

# Generate HTML + Markdown
npm run build -w packages/generator
```

Output goes to `packages/generator/output/` (gitignored).

### PDF Generation

PDF requires a LaTeX engine. Install one of:

```bash
brew install --cask basictex   # lightweight (~300MB)
# or
brew install tectonic           # standalone compiler
```

Then uncomment the latex layout in `resume.yaml`.

## Structure

```
mfyz-resume/
├── resume.yaml              ← Source of truth
├── package.json             ← Workspace root
├── packages/
│   ├── cli/                 ← npx mfyz (not yet built)
│   └── generator/           ← yamlresume PDF/HTML generation
├── source/                  ← Reference PDFs (gitignored)
└── plan.md                  ← Implementation plan
```

## Resume Data

`resume.yaml` follows the [yamlresume schema](https://yamlresume.dev/docs/compiler/schema) which is compatible with JSON Resume. Edit the YAML, validate, and regenerate.

## License

Private repository.
