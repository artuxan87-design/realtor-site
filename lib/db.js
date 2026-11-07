'use strict';
const fs = require('fs');
const path = require('path');

function defaults() {
  return {
    seq: {},
    settings: {
      rates: { solution: { l1: 20, l2: 3, l3: 2 }, service: { l1: 20, l2: 3, l3: 2 } },
      holdDays: 14,
      minPayout: 300000,
      cookieDays: 30,
      payments: {
        testMode: true, baseUrl: '',
        receipt: { mode: 'none', taxation: 'usn_income', vat: 'none' },
        providers: {},
      },
    },
    content: null,
    admin: { passHash: null },
    partners: [], customers: [], leads: [], orders: [], payments: [], accruals: [], payouts: [], log: [],
  };
}

class DB {
  constructor(file) {
    this.file = file;
    if (file && fs.existsSync(file)) {
      this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
      const d = defaults();
      for (const k of Object.keys(d)) if (this.data[k] === undefined) this.data[k] = d[k];
      for (const k of Object.keys(d.settings)) if (this.data.settings[k] === undefined) this.data.settings[k] = d.settings[k];
    } else {
      this.data = defaults();
      this.save();
    }
  }
  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
  nextId(name) { this.data.seq[name] = (this.data.seq[name] || 0) + 1; return this.data.seq[name]; }
}

module.exports = { DB, defaults };
