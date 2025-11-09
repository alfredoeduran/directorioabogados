const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const [,, inputPathArg, outputPathArg] = process.argv;
if (!inputPathArg) {
  console.error('Uso: node tools/excel_schema.js <input.xlsx> [output.json]');
  process.exit(1);
}

const inputPath = path.resolve(inputPathArg);
const outputPath = outputPathArg ? path.resolve(outputPathArg) : path.resolve(path.dirname(inputPath), 'schema.json');

try {
  const wb = XLSX.readFile(inputPath, { cellDates: true });
  const schema = {
    file: inputPath,
    sheetCount: wb.SheetNames.length,
    sheets: []
  };

  wb.SheetNames.forEach((name, index) => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    let headers = [];
    if (rows.length > 0) {
      headers = rows[0].map(h => (h === null || h === undefined ? '' : String(h).trim()));
    }

    const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
    const columnLetters = [];
    if (range) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        columnLetters.push(XLSX.utils.encode_col(c));
      }
    }

    schema.sheets.push({
      order: index + 1,
      name,
      columnLetters,
      headers
    });
  });

  fs.writeFileSync(outputPath, JSON.stringify(schema, null, 2), 'utf8');
  console.log('Schema escrito en', outputPath);
} catch (err) {
  console.error('Error procesando el Excel:', err.message);
  process.exit(2);
}