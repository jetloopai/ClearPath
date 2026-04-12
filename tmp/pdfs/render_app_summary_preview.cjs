const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { marked } = require("marked");

const root = __dirname.includes(path.join("tmp", "pdfs"))
  ? path.resolve(__dirname, "..", "..")
  : process.cwd();

const inputPath = path.join(root, "tmp", "pdfs", "clearpath_app_summary.md");
const outputPath = path.join(root, "tmp", "pdfs", "clearpath-analyzer-app-summary-preview.png");

const css = `
  @page { size: Letter; margin: 0.42in 0.5in; }
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
    background: white;
  }
  main {
    width: 8.5in;
    min-height: 11in;
    margin: 0 auto;
    padding: 0.42in 0.5in;
    background: white;
  }
  .page { min-height: 9.6in; }
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
  h1 { margin: 0; font-size: 23px; line-height: 1.05; color: var(--brand); }
  .subhead { margin: 4px 0 0; color: var(--muted); max-width: 420px; }
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
  .grid { display: grid; grid-template-columns: 1fr 1.35fr; gap: 12px; }
  .getting-started { grid-template-columns: 1.2fr 1fr; }
  .section { margin-bottom: 9px; }
  h2 {
    margin: 0 0 5px;
    font-size: 8.5px;
    line-height: 1;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--brand);
  }
  p { margin: 0; }
  ul, ol { margin: 0; padding-left: 15px; }
  li { margin: 0 0 3px; }
  strong { color: var(--ink); }
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
  const md = fs.readFileSync(inputPath, "utf8");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><main>${marked.parse(md)}</main></body></html>`;

  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1275, height: 1650, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.screenshot({ path: outputPath, clip: { x: 0, y: 0, width: 1275, height: 1650 } });
    console.log(outputPath);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
