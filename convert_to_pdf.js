const { mdToPdf } = require('md-to-pdf');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, 'outputs');
const docsDir = path.join(__dirname, 'docs');

// Professional PDF styling
const pdfConfig = {
  stylesheet: [],
  css: `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

    :root {
      --brand: #1a1a2e;
      --accent: #16213e;
      --green: #2ecc71;
      --yellow: #f39c12;
      --red: #e74c3c;
      --border: #e0e0e0;
      --bg-light: #f8f9fa;
      --text: #2c3e50;
      --text-light: #7f8c8d;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 11px;
      line-height: 1.7;
      color: var(--text);
      margin: 0;
      padding: 40px 50px;
    }

    h1 {
      font-size: 26px;
      font-weight: 700;
      color: var(--brand);
      border-bottom: 3px solid var(--brand);
      padding-bottom: 12px;
      margin-top: 0;
      margin-bottom: 8px;
    }

    h2 {
      font-size: 18px;
      font-weight: 600;
      color: var(--accent);
      margin-top: 32px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 6px;
    }

    h3 {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-top: 24px;
      margin-bottom: 8px;
    }

    h4 {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-light);
      margin-top: 16px;
    }

    /* Top metadata block */
    p strong:first-child {
      color: var(--text-light);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 10.5px;
    }

    th {
      background: var(--brand);
      color: white;
      font-weight: 600;
      text-align: left;
      padding: 8px 12px;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    td {
      padding: 7px 12px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background: var(--bg-light);
    }

    code {
      background: #f0f0f0;
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 10px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      color: #c0392b;
    }

    pre {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 16px 20px;
      border-radius: 6px;
      font-size: 10px;
      line-height: 1.6;
      overflow-x: auto;
      margin: 12px 0;
    }

    pre code {
      background: none;
      color: inherit;
      padding: 0;
      font-size: 10px;
    }

    blockquote {
      border-left: 4px solid var(--brand);
      margin: 16px 0;
      padding: 10px 16px;
      background: var(--bg-light);
      color: var(--text);
      font-style: normal;
      border-radius: 0 4px 4px 0;
    }

    blockquote strong {
      color: var(--brand);
    }

    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 24px 0;
    }

    ul, ol {
      padding-left: 24px;
    }

    li {
      margin-bottom: 4px;
    }

    strong {
      font-weight: 600;
    }

    em {
      color: var(--text-light);
    }

    /* Page break before major sections */
    h1 + hr + h2,
    h2:nth-of-type(n+3) {
      page-break-before: auto;
    }

    @media print {
      body { margin: 0; padding: 30px 40px; }
      pre { page-break-inside: avoid; }
      table { page-break-inside: avoid; }
      h2 { page-break-after: avoid; }
      h3 { page-break-after: avoid; }
    }
  `,
  pdf_options: {
    format: 'Letter',
    margin: {
      top: '0.6in',
      bottom: '0.6in',
      left: '0.7in',
      right: '0.7in'
    },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `
      <div style="width:100%;font-size:8px;font-family:Inter,sans-serif;color:#aaa;padding:0 40px;display:flex;justify-content:space-between;">
        <span>ClearPath — Confidential</span>
        <span></span>
      </div>
    `,
    footerTemplate: `
      <div style="width:100%;font-size:8px;font-family:Inter,sans-serif;color:#aaa;padding:0 40px;display:flex;justify-content:space-between;">
        <span>ClearPath Asset Group</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>
    `
  },
  launch_options: {
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
};

// File mapping: output filename → clean PDF name
const files = [
  { input: '01_calc_logic_output.md',   output: '01_Deal_Calculation_Logic.pdf' },
  { input: '02_architecture_output.md',  output: '02_System_Architecture.pdf' },
  { input: '03_ui_output.md',            output: '03_UI_UX_Wireframes.pdf' },
  { input: '04_crm_output.md',           output: '04_CRM_Lead_Flow.pdf' },
  { input: '05_automation_output.md',    output: '05_Email_SMS_Automation.pdf' },
  { input: '06_sop_output.md',           output: '06_Service_Operations_SOP.pdf' },
  { input: '07_sales_output.md',         output: '07_Sales_Script_Qualification.pdf' },
  { input: '08_content_output.md',       output: '08_Content_Engine.pdf' },
  { input: '09_database_output.md',      output: '09_Database_Schema.pdf' },
  { input: '10_legal_output.md',         output: '10_Legal_Disclaimers.pdf' },
];

async function convertAll() {
  // Ensure docs directory exists
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  ClearPath PDF Generation');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  let successCount = 0;

  for (const file of files) {
    const inputPath = path.join(outputDir, file.input);
    const outputPath = path.join(docsDir, file.output);

    if (!fs.existsSync(inputPath)) {
      console.log(`  ❌ SKIP: ${file.input} (not found)`);
      continue;
    }

    try {
      process.stdout.write(`  ⏳ Converting: ${file.output}...`);

      const pdf = await mdToPdf(
        { path: inputPath },
        {
          ...pdfConfig,
          dest: outputPath,
        }
      );

      if (pdf) {
        console.log(` ✅`);
        successCount++;
      }
    } catch (err) {
      console.log(` ❌ ERROR: ${err.message}`);
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Complete: ${successCount}/${files.length} PDFs generated`);
  console.log(`  Location: ${docsDir}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

convertAll().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
