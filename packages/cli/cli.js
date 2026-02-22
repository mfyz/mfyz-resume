#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ── ANSI escape codes ──────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  // colors
  white: '\x1b[97m',
  gray: '\x1b[90m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

// ── Layout constants ───────────────────────────────────────────────────────
const WIDTH = 80;
const PAD = 2;
const INNER = WIDTH - PAD * 2; // 76 usable chars

// ── Helpers ────────────────────────────────────────────────────────────────
const pad = (s = '') => ' '.repeat(PAD) + s;
const line = (s = '') => pad(s);
const hr = (char = '─') => pad(c.dim + char.repeat(INNER) + c.reset);
const sectionHeader = (title) =>
  pad(`${c.bold}${c.cyan} ${title.toUpperCase()} ${c.dim}${'─'.repeat(Math.max(0, INNER - title.length - 3))}${c.reset}`);

function wordWrap(text, maxWidth) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function rightAlign(left, right, width) {
  const gap = width - left.length - right.length;
  if (gap < 2) return left + '  ' + right;
  return left + ' '.repeat(gap) + right;
}

function formatDate(d) {
  if (!d) return 'Present';
  const s = String(d);
  if (s.length === 4) return s; // just year
  const [y, m] = s.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(m, 10) - 1] + ' ' + y;
}

function dateRange(start, end) {
  return formatDate(start) + '–' + formatDate(end);
}

// ── Minimal YAML parser (handles our resume.yaml structure) ────────────────
function parseYaml(text) {
  const lines = text.split('\n');
  return parseObj(lines, { i: 0 }, -1);
}

function parseObj(lines, state, parentIndent) {
  const obj = {};
  let currentKey = null;

  while (state.i < lines.length) {
    const raw = lines[state.i];
    const trimmed = raw.replace(/\r$/, '');

    // skip empty lines and comments
    if (trimmed.trim() === '' || trimmed.trim().startsWith('#')) {
      state.i++;
      continue;
    }

    const indent = trimmed.search(/\S/);
    if (indent <= parentIndent) break; // dedented = done with this object

    // array item
    if (trimmed.trim().startsWith('- ')) {
      // if we hit an array at this level, it belongs to currentKey
      if (currentKey && !Array.isArray(obj[currentKey])) {
        obj[currentKey] = [];
      }
      if (currentKey) {
        obj[currentKey] = parseArray(lines, state, indent - 2);
      } else {
        // top-level array
        return parseArray(lines, state, parentIndent);
      }
      continue;
    }

    // key: value
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      state.i++;
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    let val = trimmed.slice(colonIdx + 1).trim();

    // multi-line string (> or |)
    if (val === '>' || val === '|') {
      state.i++;
      val = parseMultiline(lines, state, indent);
      obj[key] = val;
      currentKey = key;
      continue;
    }

    // quoted string
    if ((val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    // check if next line is indented more (nested object or array)
    state.i++;
    if (state.i < lines.length) {
      const nextRaw = lines[state.i].replace(/\r$/, '');
      const nextTrimmed = nextRaw.trim();
      if (nextTrimmed !== '' && !nextTrimmed.startsWith('#')) {
        const nextIndent = nextRaw.search(/\S/);
        if (nextIndent > indent) {
          if (nextTrimmed.startsWith('- ')) {
            obj[key] = parseArray(lines, state, indent);
          } else {
            obj[key] = parseObj(lines, state, indent);
          }
          currentKey = key;
          continue;
        }
      }
    }

    obj[key] = val === '' ? {} : val;
    currentKey = key;
  }
  return obj;
}

function parseArray(lines, state, parentIndent) {
  const arr = [];

  while (state.i < lines.length) {
    const raw = lines[state.i];
    const trimmed = raw.replace(/\r$/, '').trim();

    if (trimmed === '' || trimmed.startsWith('#')) {
      state.i++;
      continue;
    }

    const indent = raw.search(/\S/);
    if (indent <= parentIndent) break;

    if (trimmed.startsWith('- ')) {
      const afterDash = trimmed.slice(2).trim();

      // simple list item (e.g. "- TypeScript")
      if (afterDash && !afterDash.includes(':')) {
        let val = afterDash;
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        arr.push(val);
        state.i++;
        continue;
      }

      // object item (e.g. "- name: Foo")
      if (afterDash.includes(':')) {
        // parse the first key:val from the dash line
        const colonIdx = afterDash.indexOf(':');
        const key = afterDash.slice(0, colonIdx).trim();
        let val = afterDash.slice(colonIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }

        state.i++;
        // parse remaining keys at deeper indent
        const itemObj = parseObj(lines, state, indent);
        if (val === '>' || val === '|') {
          itemObj[key] = parseMultiline(lines, state, indent);
        } else {
          itemObj[key] = val === '' ? {} : val;
        }
        // put first key first
        const ordered = {};
        ordered[key] = itemObj[key];
        for (const k of Object.keys(itemObj)) {
          if (k !== key) ordered[k] = itemObj[k];
        }
        arr.push(ordered);
        continue;
      }

      // dash with nested object on next lines
      state.i++;
      arr.push(parseObj(lines, state, indent));
      continue;
    }

    break;
  }
  return arr;
}

function parseMultiline(lines, state, parentIndent) {
  const parts = [];
  while (state.i < lines.length) {
    const raw = lines[state.i].replace(/\r$/, '');
    const trimmed = raw.trim();
    if (trimmed === '') {
      parts.push('');
      state.i++;
      continue;
    }
    const indent = raw.search(/\S/);
    if (indent <= parentIndent) break;
    parts.push(trimmed);
    state.i++;
  }
  return parts.filter(p => p !== '').join(' ');
}

// ── Render ─────────────────────────────────────────────────────────────────
function render(data) {
  const content = data.content || data;
  const basics = content.basics || {};
  const work = content.work || [];
  const education = content.education || [];
  const skills = content.skills || [];
  // projects intentionally omitted from CLI output
  const languages = content.languages || [];
  const certificates = content.certificates || [];

  const out = [];
  const p = (s) => out.push(s);

  // blank line
  p('');

  // ── Header box ──
  const boxW = INNER;
  const boxInner = boxW - 4; // 2 border + 2 inner padding
  p(pad(`${c.cyan}╭${'─'.repeat(boxW - 2)}╮${c.reset}`));

  const nameLine = `${c.bold}${c.white}${basics.name || ''}${c.reset}`;
  const nameLen = (basics.name || '').length;
  p(pad(`${c.cyan}│${c.reset}  ${nameLine}${' '.repeat(Math.max(0, boxInner - nameLen))}${c.cyan}│${c.reset}`));

  const headline = basics.headline || '';
  p(pad(`${c.cyan}│${c.reset}  ${c.yellow}${headline}${c.reset}${' '.repeat(Math.max(0, boxInner - headline.length))}${c.cyan}│${c.reset}`));

  const contactParts = [];
  if (basics.email) contactParts.push(basics.email);
  if (basics.url) contactParts.push(basics.url);
  if (basics.phone) contactParts.push(basics.phone);
  const contactLine = contactParts.join(' · ');
  p(pad(`${c.cyan}│${c.reset}  ${c.dim}${contactLine}${c.reset}${' '.repeat(Math.max(0, boxInner - contactLine.length))}${c.cyan}│${c.reset}`));

  p(pad(`${c.cyan}╰${'─'.repeat(boxW - 2)}╯${c.reset}`));
  p('');

  // ── Summary ──
  if (basics.summary) {
    const summaryLines = wordWrap(basics.summary, INNER - 2);
    for (const sl of summaryLines) {
      p(line(`  ${c.dim}${sl}${c.reset}`));
    }
    p('');
  }

  // ── Experience ──
  if (work.length > 0) {
    p(sectionHeader('Experience'));
    p('');

    for (const job of work) {
      const title = `${c.bold}${c.white}${job.position || ''}${c.reset}`;
      const dates = `${c.dim}${dateRange(job.startDate, job.endDate)}${c.reset}`;
      const titleLen = (job.position || '').length;
      const datesLen = dateRange(job.startDate, job.endDate).length;
      const titleLine = rightAlign(job.position || '', dateRange(job.startDate, job.endDate), INNER - 2);

      // render with colors
      p(line(`  ${c.bold}${c.white}${job.position || ''}${c.reset}${' '.repeat(Math.max(2, INNER - 2 - titleLen - datesLen))}${c.dim}${dateRange(job.startDate, job.endDate)}${c.reset}`));
      const companyParts = [job.name || ''];
      if (job.location) companyParts.push(job.location);
      p(line(`  ${c.cyan}${companyParts.join('  ·  ')}${c.reset}`));

      // full summary
      if (job.summary) {
        const sumLines = wordWrap(job.summary, INNER - 4);
        for (const sl of sumLines) {
          p(line(`  ${c.dim}${sl}${c.reset}`));
        }
      }
      p('');
    }
  }

  // ── Skills ──
  if (skills.length > 0) {
    p(sectionHeader('Skills'));
    p('');

    for (const skill of skills) {
      const kw = (skill.keywords || []).join(', ');
      const prefix = `  ${skill.name}: `;
      const availableWidth = INNER - prefix.length;
      if (kw.length <= availableWidth) {
        p(line(`  ${c.bold}${skill.name}${c.reset}${c.dim}: ${kw}${c.reset}`));
      } else {
        p(line(`  ${c.bold}${skill.name}${c.reset}`));
        const kwLines = wordWrap(kw, INNER - 6);
        for (const kl of kwLines) {
          p(line(`    ${c.dim}${kl}${c.reset}`));
        }
      }
    }
    p('');
  }

  // ── Education ──
  if (education.length > 0) {
    p(sectionHeader('Education'));
    p('');

    for (const edu of education) {
      if (edu.degree === 'High School') continue; // skip high school
      const degreeArea = [edu.degree, edu.area].filter(Boolean).join(' in ');
      const years = dateRange(edu.startDate, edu.endDate);
      p(line(`  ${c.bold}${degreeArea}${c.reset}  ${c.dim}${edu.institution || ''}  ${years}${c.reset}`));
    }
    p('');
  }

  // ── Certifications ──
  if (certificates.length > 0) {
    p(sectionHeader('Certifications'));
    p('');
    for (const cert of certificates) {
      const year = cert.date ? formatDate(cert.date) : '';
      p(line(`  ${c.dim}${cert.name}${c.reset}  ${c.dim}${cert.issuer || ''}${year ? '  ' + year : ''}${c.reset}`));
    }
    p('');
  }

  // ── Languages ──
  if (languages.length > 0) {
    const langLine = languages.map(l => {
      const fluency = (l.fluency || '').replace(' Proficiency', '');
      return `${l.language} (${fluency})`;
    }).join('  ·  ');
    p(line(`  ${c.dim}${langLine}${c.reset}`));
    p('');
  }

  // ── In Numbers (from summary) ──
  p(sectionHeader('In Numbers'));
  p('');
  const col1 = [
    `${c.bold}${c.yellow}85${c.reset} products launched`,
    `${c.bold}${c.yellow}35${c.reset} products designed`,
    `${c.bold}${c.yellow}41${c.reset} clients managed`,
  ];
  const col2 = [
    `${c.bold}${c.yellow}142${c.reset} coded commercially`,
    `${c.bold}${c.yellow}178${c.reset} repos on GitHub`,
    `${c.bold}${c.yellow}82${c.reset} teammates 1-1`,
  ];
  for (let i = 0; i < col1.length; i++) {
    // pad col1 to fixed visible width for alignment
    const col1Visible = col1[i].replace(/\x1b\[[0-9;]*m/g, '');
    const gap = 38 - col1Visible.length;
    p(line(`  ${col1[i]}${' '.repeat(Math.max(2, gap))}${col2[i]}`));
  }
  p('');

  // ── Footer ──
  p(hr());
  const pkg = getPkgVersion();
  const footer = `npx mfyz · v${pkg}`;
  const footerPad = Math.floor((INNER - footer.length) / 2);
  p(pad(`${' '.repeat(footerPad)}${c.dim}${footer}${c.reset}`));
  p('');

  return out.join('\n');
}

function getPkgVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    return '1.0.0';
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
function main() {
  const yamlPath = path.join(__dirname, 'resume.yaml');
  if (!fs.existsSync(yamlPath)) {
    console.error('resume.yaml not found');
    process.exit(1);
  }

  const raw = fs.readFileSync(yamlPath, 'utf8');
  const data = parseYaml(raw);
  console.log(render(data));
}

main();
