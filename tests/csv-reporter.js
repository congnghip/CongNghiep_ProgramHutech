const fs = require('fs');
const path = require('path');

class CsvReporter {
  constructor() {
    this.results = new Map();
  }

  onTestEnd(test, result) {
    const match = test.title.match(/^(TC_[A-Z]+_\d+)/);
    if (match) {
      const id = match[1];
      let status;
      if (result.status === 'passed') status = 'Pass';
      else if (result.status === 'failed' || result.status === 'timedOut') status = 'Fail';
      else status = 'Skip';
      this.results.set(id, status);
    }
  }

  onEnd() {
    const csvPath = path.join(__dirname, 'test-cases.csv');
    if (!fs.existsSync(csvPath)) return;

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0];
    const today = new Date().toISOString().slice(0, 10);

    const updatedLines = [header];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const fields = this._parseCsvLine(line);
      if (fields.length < 7) {
        updatedLines.push(line);
        continue;
      }

      const id = fields[0];
      if (this.results.has(id)) {
        fields[5] = this.results.get(id);
        fields[6] = today;
      }

      updatedLines.push(fields.map(f => {
        if (f.includes(',') || f.includes('"') || f.includes('\n')) {
          return '"' + f.replace(/"/g, '""') + '"';
        }
        return f;
      }).join(','));
    }

    fs.writeFileSync(csvPath, updatedLines.join('\n') + '\n', 'utf-8');
  }

  _parseCsvLine(line) {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  }
}

module.exports = CsvReporter;
