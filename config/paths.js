const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../reports');

module.exports = {
  REPORTS_DIR,
  DAYWISE_CSV: path.join(REPORTS_DIR, 'MD-report-data-Daywise.csv'),
  SITEWISE_CSV: path.join(REPORTS_DIR, 'MD-report-data-Sitewise.csv'),
};
