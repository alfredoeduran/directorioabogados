const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Uso: node tools/excel_to_json.js <input.xlsx> <output.json>
const [,, inputPathArg, outputPathArg] = process.argv;
if (!inputPathArg || !outputPathArg) {
  console.error('Uso: node tools/excel_to_json.js <input.xlsx> <output.json>');
  process.exit(1);
}

const inputPath = path.resolve(inputPathArg);
const outputPath = path.resolve(outputPathArg);

try {
  const wb = XLSX.readFile(inputPath, { cellDates: true });
  const targetHeaders = [
    'Código postal',
    'Nombre y dirección',
    'Especialidad',
    'Datos de contacto',
    'www',
    'Fuente',
    'Página PDF'
  ];

  // Encuentra la hoja que contiene estos encabezados (abogados)
  let targetSheetName = null;
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
    const headers = rows[0] ? rows[0].map(h => (h === null || h === undefined ? '' : String(h).trim())) : [];
    const matchCount = headers.filter(h => targetHeaders.includes(h)).length;
    if (matchCount >= 5) { // suficiente coincidencia
      targetSheetName = name;
      break;
    }
  }

  if (!targetSheetName) {
    throw new Error('No se encontró una hoja con los encabezados esperados de abogados');
  }

  const ws = wb.Sheets[targetSheetName];
  const dataRows = XLSX.utils.sheet_to_json(ws, { defval: '' }); // usar encabezados de la primera fila automáticamente

  // Normaliza claves y salida (abogados)
  const records = dataRows.map(row => ({
    postalCode: String(row['Código postal'] || '').trim(),
    nameAddress: String(row['Nombre y dirección'] || '').trim(),
    specialty: String(row['Especialidad'] || '').trim(),
    contact: String(row['Datos de contacto'] || '').trim(),
    website: String(row['www'] || '').trim(),
    source: String(row['Fuente'] || '').trim(),
    pdfPage: String(row['Página PDF'] || '').trim()
  })).filter(r => r.nameAddress);

  const out = {
    sourceFile: inputPath,
    sheet: targetSheetName,
    count: records.length,
    specialties: Array.from(new Set(records.map(r => r.specialty).filter(Boolean))).sort(),
    records
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`JSON escrito en ${outputPath} (registros: ${records.length})`);

  // Extraer hoja de especialidades con "Ejemplo práctico"
  const exampleHeaders = [
    'Especialidad jurídica',
    '¿Cuándo conviene recurrir a un abogado de esta rama?',
    'Ejemplo práctico'
  ];

  let exampleSheetName = null;
  for (const name of wb.SheetNames) {
    const ws2 = wb.Sheets[name];
    const rows2 = XLSX.utils.sheet_to_json(ws2, { header: 1, blankrows: false });
    const headers2 = rows2[0] ? rows2[0].map(h => (h === null || h === undefined ? '' : String(h).trim())) : [];
    const matchCount2 = headers2.filter(h => exampleHeaders.includes(h)).length;
    if (matchCount2 >= 3) { // coincide exactamente esa hoja
      exampleSheetName = name;
      break;
    }
  }

  if (exampleSheetName) {
    const ws2 = wb.Sheets[exampleSheetName];
    const rowsObj = XLSX.utils.sheet_to_json(ws2, { defval: '' });
    const examples = rowsObj.map(row => ({
      specialty: String(row['Especialidad jurídica'] || '').trim(),
      whenToUse: String(row['¿Cuándo conviene recurrir a un abogado de esta rama?'] || '').trim(),
      example: String(row['Ejemplo práctico'] || '').trim()
    })).filter(e => e.specialty || e.example || e.whenToUse);

    const examplesOut = {
      sourceFile: inputPath,
      sheet: exampleSheetName,
      count: examples.length,
      examples
    };

    const examplesPath = path.join(path.dirname(outputPath), 'especialidades.json');
    fs.writeFileSync(examplesPath, JSON.stringify(examplesOut, null, 2), 'utf8');
    console.log(`JSON de especialidades escrito en ${examplesPath} (registros: ${examples.length})`);
  } else {
    console.warn('No se encontró hoja con "Ejemplo práctico". Se omite especialidades.json');
  }
} catch (err) {
  console.error('Error exportando Excel a JSON:', err.message);
  process.exit(2);
}