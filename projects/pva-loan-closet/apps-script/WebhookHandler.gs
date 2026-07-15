/**
 * WebhookHandler.gs — receives webhook calls from AppSheet automation bots.
 *
 * AppSheet side (see docs/AppSheet_Build_Guide.md, "Bots"):
 *   Bot step type "Call a webhook" -> POST to this script's Web App URL with:
 *     {
 *       "action": "SYNC_DONATION" | "SYNC_DONOR" | "SYNC_BORROWER" | "LOAN_NOTE",
 *       "id":     "<row key, e.g. DON-0014>",
 *       "secret": "<shared secret>"
 *     }
 *
 * Deploy: Editor > Deploy > New deployment > Web app
 *   - Execute as: Me    - Who has access: Anyone (URL is unguessable + secret-checked)
 *
 * Why webhook -> Apps Script (a deliberate design decision):
 *   - The LGL API key stays server-side in Script Properties. AppSheet bots
 *     never hold CRM credentials.
 *   - AppSheet gets instant, event-driven sync (on donation save) while the
 *     nightly batch (SyncEngine.nightlyLGLSync) sweeps up anything missed.
 *   - One integration surface to test: the same SyncEngine functions serve
 *     the webhook, the nightly trigger, and the menu-driven manual sync.
 */

var WEBHOOK_SECRET_PROP = 'WEBHOOK_SHARED_SECRET';

/** POST entry point (AppSheet bots). */
function doPost(e) {
  var out = { ok: false };
  try {
    var req = JSON.parse(e.postData.contents || '{}');

    // Fail CLOSED: an unset/blank shared secret rejects every call rather than
    // disabling the check. The webhook must not process anonymous POSTs before
    // WEBHOOK_SHARED_SECRET is configured (see Build Guide §1).
    var expected = PropertiesService.getScriptProperties().getProperty(WEBHOOK_SECRET_PROP);
    if (!expected || req.secret !== expected) {
      out.error = 'Unauthorized';
      return jsonOut_(out, 401);
    }

    switch (req.action) {
      case 'SYNC_DONOR':
        out.lglConstituentId = syncDonor(req.id);
        out.ok = out.lglConstituentId !== null;
        break;
      case 'SYNC_DONATION':
        out.lglGiftId = syncDonationGift(req.id);
        out.ok = out.lglGiftId !== null;
        break;
      case 'SYNC_BORROWER':
        out.lglConstituentId = syncBorrower(req.id);
        out.ok = out.lglConstituentId !== null;
        break;
      case 'LOAN_NOTE':
        out.ok = attachLoanNote_(req.id);
        break;
      default:
        out.error = 'Unknown action: ' + req.action;
    }
  } catch (err) {
    out.error = String(err);
    logSync_('Push', 'Webhook', (e && e.postData && e.postData.contents || '').slice(0, 60),
             '', 'Webhook dispatch', 'Error', '500', String(err));
  }
  return jsonOut_(out, out.ok ? 200 : 422);
}

/** GET health check — open the Web App URL in a browser to verify deployment. */
function doGet() {
  return jsonOut_({ ok: true, service: 'PVA Loan Closet sync webhook',
                    mode: CFG.get().lglMode, time: nowStamp_() }, 200);
}

/** Write a loan-activity note onto the borrower's LGL constituent. */
function attachLoanNote_(loanId) {
  var loan = readTable_('Loans').filter(function (l) { return l.LoanID === loanId; })[0];
  if (!loan) throw new Error('Unknown loan ' + loanId);
  var borrower = readTable_('Borrowers').filter(function (b) { return b.BorrowerID === loan.BorrowerID; })[0];
  var eq = readTable_('Equipment').filter(function (x) { return x.EquipmentID === loan.EquipmentID; })[0];

  var cid = borrower && borrower.LGLConstituentID ? String(borrower.LGLConstituentID) : syncBorrower(loan.BorrowerID);
  if (!cid) return false;

  var txt = 'Loan ' + loan.LoanID + ': ' + (eq ? eq.Category + ' (' + eq.AssetTag + ')' : loan.EquipmentID) +
            ' — status ' + loan.Status +
            (loan.ReturnedDate ? ', returned ' + formatDateISO_(loan.ReturnedDate)
                               : ', due ' + formatDateISO_(loan.DueDate));
  var note = LGL.createNote(cid, txt);
  logSync_('Push', 'Loan', loanId, cid, 'Attach Loan Note', note.ok ? 'Success' : 'Error',
           note.httpStatus, txt.slice(0, 80));
  return note.ok;
}

function jsonOut_(obj, _status) {
  // Apps Script web apps always return 200 to the caller; the payload carries
  // real status. AppSheet bots read `ok` from the response body.
  obj.httpStatus = _status;
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
