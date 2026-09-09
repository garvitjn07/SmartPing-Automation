const xlsx = require("xlsx");

class CommonUtils {
  static loadXlsRowsBySheetName(dataFile, sheetName = "Sheet1") {
    if (!dataFile) {
      throw new Error("Smartping data file is required");
    }

    const workbook = xlsx.readFile(`./testdata/${dataFile}`);
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      throw new Error(`Worksheet "${sheetName}" was not found in ${dataFile}`);
    }

    const rows = xlsx.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
    });
    const headers = rows[0] || [];

    return rows.slice(1).map((values) =>
      headers.reduce((row, header, index) => {
        if (header !== "") row[header] = values[index] ?? "";
        return row;
      }, {}),
    );
  }
}

module.exports = CommonUtils;
