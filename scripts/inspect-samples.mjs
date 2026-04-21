import XLSX from 'xlsx';

for (const file of ['samples-product.xls', 'samples-refund.xlsx']) {
  const workbook = XLSX.readFile(file, { cellDates: true });
  console.log(`FILE: ${file}`);
  console.log(`SHEETS: ${workbook.SheetNames.join(' | ')}`);
  for (const sheetName of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: null, blankrows: false });
    console.log(`SHEET: ${sheetName}`);
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
  }
}
