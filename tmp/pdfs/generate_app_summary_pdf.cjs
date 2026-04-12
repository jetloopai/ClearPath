const fs = require("fs");
const path = require("path");
const { mdToPdf } = require("md-to-pdf");

const root = __dirname.includes(path.join("tmp", "pdfs"))
  ? path.resolve(__dirname, "..", "..")
  : process.cwd();

const inputPath = path.join(root, "tmp", "pdfs", "clearpath_app_summary.md");
const outputDir = path.join(root, "output", "pdf");
const outputPath = path.join(outputDir, "clearpath-analyzer-app-summary.pdf");

const css = `
  @page {
    size: Letter;
    margin: 0.42in 0.5in;
  }

  :root {
    --ink: #18212f;
    --muted: #5f6b7d;
    --line: #d8deea;
    --panel: #f5f8fc;
    --brand: #123a63;
    --brand-soft: #dfeaf8;
  }

  * { box-sizing: border-box; }

  body {
    font-family: Arial, Helvetica, sans-serif;
    color: var(--ink);
    margin: 0;
    font-size: 10px;
    line-height: 1.33;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    min-height: 9.6in;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-start;
    border-bottom: 2px solid var(--brand);
    padding-bottom: 8px;
    margin-bottom: 10px;
  }

  .eyebrow {
    font-size: 8px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--brand);
    margin-bottom: 3px;
    font-weight: 700;
  }

  h1 {
    margin: 0;
    font-size: 23px;
    line-height: 1.05;
    color: var(--brand);
  }

  .subhead {
    margin: 4px 0 0;
    color: var(--muted);
    max-width: 420px;
  }

  .badge {
    background: var(--brand-soft);
    color: var(--brand);
    border: 1px solid #c4d6ef;
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 8.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .grid {
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 12px;
  }

  .getting-started {
    grid-template-columns: 1.2fr 1fr;
  }

  .section {
    margin-bottom: 9px;
    break-inside: avoid;
    page-break-inside: avoid;
  }

  h2 {
    margin: 0 0 5px;
    font-size: 8.5px;
    line-height: 1;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--brand);
  }

  p {
    margin: 0;
  }

  ul, ol {
    margin: 0;
    padding-left: 15px;
  }

  li {
    margin: 0 0 3px;
  }

  strong {
    color: var(--ink);
  }

  code {
    font-family: "Courier New", monospace;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 0 3px;
    font-size: 9px;
  }
`;

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  const pdf = await mdToPdf(
    { path: inputPath },
    {
      dest: outputPath,
      css,
      marked_options: {
        gfm: true,
        breaks: false,
      },
      pdf_options: {
        format: "Letter",
        printBackground: true,
        margin: {
          top: "0.42in",
          right: "0.5in",
          bottom: "0.42in",
          left: "0.5in",
        },
        displayHeaderFooter: false,
      },
      launch_options: {
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
    }
  );

  if (!pdf) {
    throw new Error("md-to-pdf did not return a PDF buffer");
  }

  const raw = fs.readFileSync(outputPath);
  const pageMatches = raw.toString("latin1").match(/\/Type\s*\/Page\b/g) || [];
  console.log(JSON.stringify({ outputPath, approxPageCount: pageMatches.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
