/**
 * Notifications.gs — scheduled email logic for loans (due-soon + overdue)
 * and the staff morning digest.
 *
 * Division of labor (a deliberate design decision, documented in the
 * Executive Summary):
 *   - EVENT-driven notifications (donation receipt on intake, loan
 *     confirmation on checkout, return thank-you, new-ticket alert) live in
 *     AppSheet bots — they fire on Adds/Updates and are configured in the
 *     AppSheet editor (see AppSheet_Build_Guide.md).
 *   - SCHEDULE-driven notifications (due-soon reminders, overdue notices,
 *     morning digest) live HERE, because Apps Script time triggers give finer
 *     control (cadence windows, escalating notice counts, one digest across
 *     many rows) and keep all date-math in one testable place. AppSheet's
 *     scheduled bots could do simple versions of these; the script versions
 *     add per-row cadence tracking (LastReminderSentAt / OverdueNoticeCount).
 *
 * DRY_RUN mode: with Config!LGL_Mode = MOCK, emails are logged to the sheet
 * and Logger instead of actually sending — safe for the demo. Set to LIVE to
 * send via MailApp.
 */

/** True when we should log instead of send. */
function isDryRun_() { return CFG.get().lglMode !== 'LIVE'; }

function sendMail_(to, subject, body) {
  if (isDryRun_()) {
    Logger.log('[DRY RUN EMAIL] to=%s | %s\n%s', to, subject, body);
    logSync_('Push', 'Email', to, '', subject.slice(0, 60), 'DryRun', '', body.slice(0, 90));
    return 'dry-run';
  }
  MailApp.sendEmail({ to: to, subject: subject, body: body, name: CFG.get().orgName,
                      replyTo: CFG.get().closetEmail });
  return 'sent';
}

// ---------------------------------------------------------------------------
// Daily loan scan  (install trigger: dailyLoanScan, time-driven, 8-9am)
// ---------------------------------------------------------------------------

function dailyLoanScan() {
  var cfg = CFG.get();
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var msPerDay = 24 * 60 * 60 * 1000;

  var borrowers = {};
  readTable_('Borrowers').forEach(function (b) { borrowers[b.BorrowerID] = b; });
  var equipment = {};
  readTable_('Equipment').forEach(function (x) { equipment[x.EquipmentID] = x; });

  var stats = { dueSoon: 0, overdue: 0, statusFlips: 0 };

  readTable_('Loans').forEach(function (loan) {
    if (loan.Status !== 'Active' && loan.Status !== 'Overdue') return;

    var due = parseLocalDate_(loan.DueDate); due.setHours(0, 0, 0, 0);
    var daysToDue = Math.round((due - today) / msPerDay);
    var b = borrowers[loan.BorrowerID] || {};
    var eq = equipment[loan.EquipmentID] || {};
    var item = (eq.Category || 'equipment') + ' (' + (eq.AssetTag || loan.EquipmentID) + ')';

    // --- 1. Flip Active -> Overdue when past due -------------------------
    if (daysToDue < 0 && loan.Status === 'Active') {
      writeCell_('Loans', loan._rowIndex, 'Status', 'Overdue');
      stats.statusFlips++;
      loan.Status = 'Overdue';
    }

    // --- 2. Due-soon reminder (once, inside the window) ------------------
    if (loan.Status === 'Active' &&
        daysToDue >= 0 && daysToDue <= cfg.reminderDaysBeforeDue &&
        !loan.LastReminderSentAt) {
      sendMail_(b.Email, 'Reminder: your borrowed ' + (eq.Category || 'item') +
                ' is due ' + formatDateISO_(due),
        'Hi ' + b.FirstName + ',\n\n' +
        'A friendly reminder that the ' + item + ' you borrowed from the ' +
        cfg.orgName + ' is due back on ' + formatDateISO_(due) + '.\n\n' +
        'Need more time? Just reply to this email and we’ll extend your loan.\n\n' +
        'Thank you!\n' + cfg.orgName);
      writeCell_('Loans', loan._rowIndex, 'LastReminderSentAt', nowStamp_());
      stats.dueSoon++;
    }

    // --- 3. Overdue notice (repeats on a cadence, escalating count) ------
    if (loan.Status === 'Overdue') {
      var lastSent = loan.LastReminderSentAt ? parseLocalDate_(loan.LastReminderSentAt) : null;
      var daysSince = lastSent ? Math.round((today - lastSent) / msPerDay) : 999;
      if (daysSince >= cfg.overdueReminderEveryDays) {
        var count = Number(loan.OverdueNoticeCount || 0) + 1;
        sendMail_(b.Email, 'Overdue: please return the ' + (eq.Category || 'item') +
                  ' (notice ' + count + ')',
          'Hi ' + b.FirstName + ',\n\n' +
          'Our records show the ' + item + ' was due back on ' +
          formatDateISO_(due) + '. Other neighbors are waiting for this equipment.\n\n' +
          'Please drop it off at the base, or reply if you need it longer or ' +
          'need a pickup arranged.\n\nThank you!\n' + cfg.orgName);
        writeCell_('Loans', loan._rowIndex, 'LastReminderSentAt', nowStamp_());
        writeCell_('Loans', loan._rowIndex, 'OverdueNoticeCount', count);
        stats.overdue++;

        // Escalate to a support ticket after the 2nd unanswered notice
        if (count >= 2) ensureOverdueTicket_(loan, b, item);
      }
    }
  });

  Logger.log('dailyLoanScan: %s', JSON.stringify(stats));
  return stats;
}

/** Create an Overdue Follow-up ticket once per loan (skip if one exists). */
function ensureOverdueTicket_(loan, borrower, itemLabel) {
  var existing = readTable_('SupportTickets').some(function (t) {
    return t.LoanID === loan.LoanID && t.IssueType === 'Overdue Follow-up' &&
           t.Status !== 'Resolved' && t.Status !== 'Closed';
  });
  if (existing) return;

  var sh = getSheet_('SupportTickets');
  var ticketId = 'TKT-' + Utilities.formatString('%04d', maxIdSuffix_('SupportTickets') + 1);
  sh.appendRow([ticketId, loan.EquipmentID, loan.LoanID, 'System (auto)', 'Staff',
                'Overdue Follow-up', 'High', 'New', nowStamp_(), '', '',
                'Auto-created after notice ' + loan.OverdueNoticeCount +
                ' to ' + (borrower.FirstName || '') + ' ' + (borrower.LastName || '') +
                ' re: ' + itemLabel]);
  sendMail_(CFG.get().staffAlertEmail, '[Loan Closet] Escalation: ' + ticketId + ' overdue follow-up',
            'Loan ' + loan.LoanID + ' (' + itemLabel + ') has had ' + loan.OverdueNoticeCount +
            ' overdue notices with no return. Ticket ' + ticketId + ' created for phone follow-up.');
}

// ---------------------------------------------------------------------------
// Staff morning digest  (install trigger: morningDigest, time-driven, 7-8am)
// ---------------------------------------------------------------------------

function morningDigest() {
  var cfg = CFG.get();
  var loans = readTable_('Loans');
  var tickets = readTable_('SupportTickets');
  var donations = readTable_('Donations');

  var overdue = loans.filter(function (l) { return l.Status === 'Overdue'; });
  var openTickets = tickets.filter(function (t) { return t.Status === 'New' || t.Status === 'In Progress' || t.Status === 'Waiting on Parts'; });
  var pendingReceipts = donations.filter(function (d) { return d.ReceiptSent !== 'Y'; });
  var pendingSync = donations.filter(function (d) { return d.LGLSyncStatus === 'Pending' || d.LGLSyncStatus === 'Not Synced'; });

  var lines = [
    'Good morning — Loan Closet status for ' + nowStamp_() + ':', '',
    'Overdue loans: ' + overdue.length,
    overdue.map(function (l) { return '  - ' + l.LoanID + ' (' + l.EquipmentID + ') due ' + formatDateISO_(l.DueDate) + ', notices: ' + (l.OverdueNoticeCount || 0); }).join('\n'),
    '',
    'Open tickets: ' + openTickets.length,
    openTickets.map(function (t) { return '  - ' + t.TicketID + ' [' + t.Priority + '] ' + t.IssueType + ' — ' + t.Status; }).join('\n'),
    '',
    'Donation receipts to send: ' + pendingReceipts.length,
    'Donations awaiting LGL sync: ' + pendingSync.length
  ];

  sendMail_(cfg.staffAlertEmail, '[Loan Closet] Morning digest — ' +
            overdue.length + ' overdue / ' + openTickets.length + ' open tickets',
            lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Custom menu for manual runs from the spreadsheet
// ---------------------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Loan Closet')
    .addItem('Run daily loan scan now', 'dailyLoanScan')
    .addItem('Send morning digest now', 'morningDigest')
    .addItem('Run nightly LGL sync now', 'nightlyLGLSync')
    .addSeparator()
    .addItem('Run integration tests (mock)', 'runAllTests')
    .addToUi();
}
