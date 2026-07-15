/**
 * Config.gs — central configuration for the PVA Loan Closet prototype.
 *
 * Two layers of config:
 *   1. The "Config" tab of the backend spreadsheet (non-secret, staff-editable):
 *      loan periods, reminder windows, org display name, LGL_Mode (MOCK|LIVE).
 *   2. Script Properties (secrets — NEVER stored in the sheet):
 *      LGL_API_KEY. Set via Apps Script editor > Project Settings > Script Properties,
 *      or run setupScriptProperties() once and then delete your key from the code.
 *
 * SECURITY NOTE: the LGL API key grants full read/write on the LGL account.
 * Keeping it in Script Properties (not the spreadsheet, not the AppSheet app)
 * means app users can never see it — only the script owner can.
 */

var CFG = (function () {
  var cache = null;

  function readSheetConfig_() {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rows = ss.getSheetByName('Config').getDataRange().getValues();
    var out = {};
    for (var i = 1; i < rows.length; i++) {
      if (rows[i][0]) out[String(rows[i][0]).trim()] = String(rows[i][1]).trim();
    }
    return out;
  }

  return {
    /** Returns merged config: sheet Config tab + defaults. Cached per execution. */
    get: function () {
      if (cache) return cache;
      var sheet = readSheetConfig_();
      cache = {
        loanPeriodDays: Number(sheet.LoanPeriodDays || 90),
        reminderDaysBeforeDue: Number(sheet.ReminderDaysBeforeDue || 7),
        overdueReminderEveryDays: Number(sheet.OverdueReminderEveryDays || 7),
        closetEmail: sheet.ClosetEmail || 'loancloset.demo@example.org',
        staffAlertEmail: sheet.StaffAlertEmail || 'opsdesk.demo@example.org',
        lglMode: (sheet.LGL_Mode || 'MOCK').toUpperCase(),   // MOCK | LIVE
        lglBaseUrl: sheet.LGL_BaseUrl || 'https://api.littlegreenlight.com/api/v1',
        orgName: sheet.OrgName || 'Pittsford Volunteer Ambulance — Loan Closet',
        timeZone: sheet.TimeZone || 'America/New_York'
      };
      return cache;
    },

    /** LGL API key from Script Properties. Only needed when LGL_Mode = LIVE. */
    lglApiKey: function () {
      var key = PropertiesService.getScriptProperties().getProperty('LGL_API_KEY');
      if (!key && CFG.get().lglMode === 'LIVE') {
        throw new Error('LGL_API_KEY missing from Script Properties (required in LIVE mode).');
      }
      return key || 'MOCK-KEY';
    }
  };
})();

/**
 * One-time setup helper. Paste your key, run once from the editor, then
 * REMOVE the key from this file. (Left blank on purpose in the repo.)
 */
function setupScriptProperties() {
  PropertiesService.getScriptProperties().setProperty('LGL_API_KEY', 'PASTE-KEY-THEN-DELETE');
}

/** Convenience: get a sheet by name with a clear error. */
function getSheet_(name) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh) throw new Error('Missing required tab: ' + name);
  return sh;
}

/** Read a whole table into objects keyed by header row. */
function readTable_(sheetName) {
  var values = getSheet_(sheetName).getDataRange().getValues();
  var headers = values[0].map(String);
  // Assign _rowIndex from the ORIGINAL sheet position (before dropping blank
  // rows), so writeCell_ always targets the correct row even when interior
  // rows are blank.
  return values.slice(1).map(function (r, idx) {
    var o = { _rowIndex: idx + 2 }; // 1-based sheet row
    headers.forEach(function (h, j) { o[h] = r[j]; });
    return o;
  }).filter(function (o) { return o[headers[0]] !== ''; });
}

/**
 * Parse a sheet date value to a Date in the SCRIPT's local timezone, without
 * the UTC shift that `new Date('yyyy-MM-dd')` introduces (that parses as UTC
 * midnight, which formatDate/day-math then render one calendar day early in
 * America/New_York). Accepts a Date, 'yyyy-MM-dd', or 'yyyy-MM-dd HH:mm'.
 */
function parseLocalDate_(v) {
  if (v instanceof Date) return v;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return new Date(s); // last-resort fallback for unexpected formats
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]),
                  Number(m[4] || 0), Number(m[5] || 0), 0, 0);
}

/**
 * Next sequence number for an id column (column 1, rows below the header):
 * the max numeric suffix already present, plus one. Robust to deletion of a
 * non-last row — unlike getLastRow(), which would re-mint an id that still
 * exists elsewhere in the table.
 */
function maxIdSuffix_(sheetName) {
  var sh = getSheet_(sheetName);
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  var max = 0;
  for (var i = 0; i < ids.length; i++) {
    var m = String(ids[i][0]).match(/(\d+)\s*$/);
    if (m) { var n = Number(m[1]); if (n > max) max = n; }
  }
  return max;
}

/** Update one cell of a table row by header name. */
function writeCell_(sheetName, rowIndex, headerName, value) {
  var sh = getSheet_(sheetName);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  var col = headers.indexOf(headerName) + 1;
  if (col === 0) throw new Error(sheetName + ' has no column ' + headerName);
  sh.getRange(rowIndex, col).setValue(value);
}

/** Timestamp string in org timezone. */
function nowStamp_() {
  return Utilities.formatDate(new Date(), CFG.get().timeZone, 'yyyy-MM-dd HH:mm');
}
