import * as XLSX from 'xlsx';

/**
 * Parse an Excel file into REXON test case JSON format.
 *
 * Expected Excel columns (row 1 = headers):
 * | Test Name | URL | Action | Selector | Value | Condition | Description |
 *
 * Multiple steps for the same test are grouped by Test Name.
 * Returns array of test case objects ready for the REXON API.
 */
export function parseExcelToTestCases(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Use first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON rows
        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          blankrows: false
        });

        if (rows.length < 2) {
          throw new Error('Excel file must have a header row and at least one data row');
        }

        // Normalize headers
        const rawHeaders = rows[0].map(h => String(h).trim().toLowerCase());
        const headers = rawHeaders;

        // Column index mapping (flexible — matches common variations)
        const col = {
          name:        findCol(headers, ['test name', 'testname', 'name', 'test']),
          url:         findCol(headers, ['url', 'page url', 'pageurl', 'base url']),
          action:      findCol(headers, ['action', 'step action', 'type']),
          selector:    findCol(headers, ['selector', 'element', 'locator', 'css', 'xpath']),
          value:       findCol(headers, ['value', 'input', 'data', 'text']),
          condition:   findCol(headers, ['condition', 'assertion', 'expect', 'check']),
          description: findCol(headers, ['description', 'desc', 'notes', 'comment'])
        };

        if (col.name === -1) throw new Error('Missing "Test Name" column');
        if (col.action === -1) throw new Error('Missing "Action" column');

        // Group rows by test name
        const testMap = new Map();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const testName = String(row[col.name] || '').trim();
          if (!testName) continue;

          if (!testMap.has(testName)) {
            testMap.set(testName, {
              name: testName,
              url: col.url !== -1 ? String(row[col.url] || '').trim() : '',
              steps: []
            });
          }

          const step = {
            action: String(row[col.action] || '').trim().toLowerCase()
          };

          if (col.selector !== -1 && row[col.selector]) {
            step.selector = String(row[col.selector]).trim();
          }
          if (col.value !== -1 && row[col.value]) {
            step.value = String(row[col.value]).trim();
          }
          if (col.condition !== -1 && row[col.condition]) {
            step.condition = String(row[col.condition]).trim().toLowerCase();
          }
          if (col.description !== -1 && row[col.description]) {
            step.description = String(row[col.description]).trim();
          }

          // Also grab URL from step row if test-level URL is missing
          if (col.url !== -1 && row[col.url] && !testMap.get(testName).url) {
            testMap.get(testName).url = String(row[col.url]).trim();
          }

          testMap.get(testName).steps.push(step);
        }

        const testCases = Array.from(testMap.values()).filter(tc => tc.steps.length > 0);

        if (testCases.length === 0) {
          throw new Error('No valid test cases found in the Excel file');
        }

        resolve(testCases);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Find first matching column index from a list of possible header names
 */
function findCol(headers, candidates) {
  for (const candidate of candidates) {
    const idx = headers.findIndex(h => h.includes(candidate));
    if (idx !== -1) return idx;
  }
  return -1;
}

/**
 * Validate parsed test cases and return warnings
 */
export function validateTestCases(testCases) {
  const warnings = [];
  const validActions = ['navigate', 'click', 'fill', 'type', 'expect', 'wait', 'select', 'hover', 'scroll', 'screenshot'];

  testCases.forEach((tc, i) => {
    if (!tc.url) warnings.push(`Test "${tc.name}": no URL specified`);
    if (!tc.steps || tc.steps.length === 0) warnings.push(`Test "${tc.name}": no steps`);

    tc.steps?.forEach((step, j) => {
      if (!validActions.includes(step.action)) {
        warnings.push(`Test "${tc.name}" step ${j + 1}: unknown action "${step.action}" — will be passed to Claude`);
      }
      if (['click', 'fill', 'expect'].includes(step.action) && !step.selector) {
        warnings.push(`Test "${tc.name}" step ${j + 1}: "${step.action}" missing selector`);
      }
      if (step.action === 'fill' && !step.value) {
        warnings.push(`Test "${tc.name}" step ${j + 1}: "fill" missing value`);
      }
    });
  });

  return warnings;
}

/**
 * Generate a template Excel file as a downloadable blob
 */
export function generateExcelTemplate() {
  const templateData = [
    ['Test Name', 'URL', 'Action', 'Selector', 'Value', 'Condition', 'Description'],
    ['Login Happy Path', 'https://yourapp.com/login', 'navigate', '', '', '', 'Open login page'],
    ['Login Happy Path', '', 'fill', '#email', 'user@test.com', '', 'Enter email'],
    ['Login Happy Path', '', 'fill', '#password', 'password123', '', 'Enter password'],
    ['Login Happy Path', '', 'click', 'button[type="submit"]', '', '', 'Click login button'],
    ['Login Happy Path', '', 'expect', '.dashboard', '', 'visible', 'Dashboard should appear'],
    ['Search Flow', 'https://yourapp.com', 'navigate', '', '', '', 'Open homepage'],
    ['Search Flow', '', 'fill', '#search-input', 'test query', '', 'Type in search box'],
    ['Search Flow', '', 'click', '#search-btn', '', '', 'Submit search'],
    ['Search Flow', '', 'expect', '.results-list', '', 'visible', 'Results should show'],
    ['404 Page Check', 'https://yourapp.com/nonexistent', 'navigate', '', '', '', 'Visit missing page'],
    ['404 Page Check', '', 'expect', 'h1', '404', 'contain', 'Should show 404']
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(templateData);

  // Column widths
  ws['!cols'] = [
    { wch: 22 }, { wch: 35 }, { wch: 12 }, { wch: 30 },
    { wch: 20 }, { wch: 12 }, { wch: 30 }
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'TestCases');
  XLSX.writeFile(wb, 'rexon-test-template.xlsx');
}
