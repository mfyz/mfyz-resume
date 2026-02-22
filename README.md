# mfyz-resume

Personal resume toolkit — monorepo with two packages sharing a single `resume.yaml`.

## `npx fatih-yildiz`

View my resume in your terminal:

```bash
npx fatih-yildiz
```

Zero dependencies. Just a single vanilla JS file and bundled YAML data — no frameworks, no network calls, nothing sketchy. [Read the source](packages/cli/cli.js), it's ~400 lines.

## Packages

### `fatih-yildiz` ([npm](https://www.npmjs.com/package/fatih-yildiz))

Terminal resume with ANSI colors, formatted for 80-char width.

- Zero dependencies — Node.js builtins only (`fs`, `path`)
- Single JS file + bundled YAML data
- No network requests, no telemetry

### `@mfyz/resume-generator` (private)

PDF/HTML/Markdown generation powered by [yamlresume](https://yamlresume.dev/).

- Validates `resume.yaml` against yamlresume schema
- Generates HTML (calm template), Markdown, and PDF (moderncv-classic template)
- PDF via LaTeX using tectonic

## Development

```bash
# Install dependencies
npm install

# Run CLI locally
node packages/cli/cli.js

# Validate resume data
npm run validate -w packages/generator

# Generate HTML, Markdown, and PDF
npm run build -w packages/generator
```

Output goes to `packages/generator/output/` (gitignored).

### Prerequisites

PDF generation requires a LaTeX engine:

```bash
brew install tectonic
```

First build is slow (downloads LaTeX packages). Subsequent builds are fast.

## Structure

```
mfyz-resume/
├── resume.yaml              <- Source of truth
├── package.json             <- Workspace root
├── packages/
│   ├── cli/                 <- npx fatih-yildiz
│   └── generator/           <- yamlresume PDF/HTML/MD generation
└── source/                  <- Reference PDFs (gitignored)
```

## Resume Data

`resume.yaml` follows the [yamlresume schema](https://yamlresume.dev/docs/compiler/schema) which is compatible with JSON Resume.

## License

MIT
