import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const mdPath = resolve(import.meta.dirname, "../../COLLEGE_PROJECT_REPORT.md");
const htmlPath = resolve(import.meta.dirname, "../../COLLEGE_PROJECT_REPORT.html");

const md = readFileSync(mdPath, "utf8");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/);
  let html = [];
  let inCode = false;
  let codeLang = "";
  let codeBuffer = [];
  let inTable = false;
  let tableBuffer = [];
  let inList = false;
  let listType = "";

  function flushList() {
    if (inList) {
      html.push(`</${listType}>`);
      inList = false;
      listType = "";
    }
  }

  function flushTable() {
    if (inTable && tableBuffer.length > 0) {
      let tableHtml = ['<table class="report-table">'];
      let isHeader = true;
      for (let i = 0; i < tableBuffer.length; i++) {
        const row = tableBuffer[i].trim();
        if (/^\|?\s*[-:]+[-|\s:]*\|?$/.test(row)) {
          isHeader = false;
          continue;
        }
        const cells = row.split("|").slice(1, -1).map(c => c.trim());
        const tag = isHeader ? "th" : "td";
        tableHtml.push("<tr>" + cells.map(c => `<${tag}>${inlineFormat(c)}</${tag}>`).join("") + "</tr>");
        if (isHeader) isHeader = false;
      }
      tableHtml.push("</table>");
      html.push(tableHtml.join("\n"));
      inTable = false;
      tableBuffer = [];
    }
  }

  function inlineFormat(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
      .replace(/\$([^\$]+)\$/g, '<span class="math">$1</span>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      flushList();
      flushTable();
      if (!inCode) {
        inCode = true;
        codeLang = line.slice(3).trim();
        codeBuffer = [];
      } else {
        inCode = false;
        if (codeLang === "mermaid") {
          html.push(`<div class="mermaid">\n${codeBuffer.join("\n")}\n</div>`);
        } else {
          html.push(`<pre><code class="language-${codeLang}">${escapeHtml(codeBuffer.join("\n"))}</code></pre>`);
        }
        codeBuffer = [];
        codeLang = "";
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    // Tables
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      inTable = true;
      tableBuffer.push(line);
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Horizontal Rule
    if (/^---$/.test(line.trim())) {
      flushList();
      html.push('<div class="page-break"></div>');
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const title = inlineFormat(headingMatch[2]);
      const cls = level === 1 ? ' class="chapter-title"' : '';
      html.push(`<h${level}${cls}>${title}</h${level}>`);
      continue;
    }

    // Unordered Lists
    const ulMatch = line.match(/^\s*[\*\-]\s+(.*)$/);
    if (ulMatch) {
      if (!inList || listType !== "ul") {
        flushList();
        inList = true;
        listType = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    // Ordered Lists
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if (olMatch) {
      if (!inList || listType !== "ol") {
        flushList();
        inList = true;
        listType = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    flushList();

    // Empty lines
    if (!line.trim()) {
      continue;
    }

    // Paragraphs
    html.push(`<p>${inlineFormat(line)}</p>`);
  }

  flushList();
  flushTable();

  return html.join("\n");
}

const bodyHtml = markdownToHtml(md);

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ProxiFix Academic Project Report - Ravi Ranjan</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    mermaid.initialize({ startOnLoad: true, theme: 'neutral' });
  </script>
  <style>
    @page {
      size: A4;
      margin: 20mm 18mm 20mm 18mm;
    }
    @media print {
      body {
        font-size: 11pt;
        color: #111;
      }
      .page-break {
        page-break-after: always;
        break-after: page;
        height: 0;
        margin: 0;
        border: none;
      }
      h1.chapter-title {
        page-break-before: always;
        break-before: page;
      }
      table, pre, .mermaid {
        page-break-inside: avoid;
      }
      a {
        color: #0b57d0;
        text-decoration: none;
      }
    }
    body {
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.65;
      color: #222;
      background: #fff;
      max-width: 860px;
      margin: 0 auto;
      padding: 30px;
    }
    h1, h2, h3, h4, h5 {
      color: #0d1b2a;
      font-weight: 700;
      margin-top: 1.6em;
      margin-bottom: 0.5em;
    }
    h1 {
      font-size: 20pt;
      border-bottom: 2px solid #0066cc;
      padding-bottom: 8px;
    }
    h2 {
      font-size: 15pt;
      border-bottom: 1px solid #ddd;
      padding-bottom: 5px;
    }
    h3 {
      font-size: 12.5pt;
    }
    p {
      margin: 0.7em 0;
      text-align: justify;
    }
    .page-break {
      margin: 30px 0;
      border-bottom: 1px dashed #ccc;
    }
    .report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.2em 0;
      font-size: 9.5pt;
    }
    .report-table th, .report-table td {
      border: 1px solid #ccd1d9;
      padding: 7px 10px;
      text-align: left;
    }
    .report-table th {
      background-color: #f1f5f9;
      color: #1e293b;
      font-weight: 600;
    }
    .report-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    pre {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0066cc;
      border-radius: 4px;
      padding: 12px;
      font-family: 'Consolas', 'Courier New', monospace;
      font-size: 9pt;
      overflow-x: auto;
      line-height: 1.45;
    }
    code {
      font-family: 'Consolas', 'Courier New', monospace;
      background: #f1f5f9;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 9pt;
      color: #0f172a;
    }
    ul, ol {
      padding-left: 24px;
      margin: 0.8em 0;
    }
    li {
      margin-bottom: 0.35em;
    }
    .mermaid {
      background: #fafbfc;
      border: 1px solid #e1e4e8;
      border-radius: 6px;
      padding: 16px;
      margin: 20px 0;
      text-align: center;
    }
    .math {
      font-style: italic;
      font-family: 'Cambria Math', 'Times New Roman', serif;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;

writeFileSync(htmlPath, fullHtml, "utf8");
console.log("Generated HTML report at:", htmlPath);
