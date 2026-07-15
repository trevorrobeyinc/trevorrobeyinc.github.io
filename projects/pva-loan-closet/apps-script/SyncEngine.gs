/**
 * SyncEngine.gs — business logic that keeps the Loan Closet backend and
 * Little Green Light in sync. Every operation appends to the LGL_SyncLog tab
 * so staff (and the AppSheet "Sync Log" view) can audit exactly what happened.
 *
 * Sync design decisions:
 *   - MATCH-BEFORE-CREATE: donors/borrowers are searched in LGL by email
 *     first. 1 match -> link it. 0 matches -> create. 2+ matches -> flag as
 *     Error (status 300) for human review; we never guess and never create
 *     duplicates. Duplicate constituents are the classic CRM-integration
 *     failure mode, so ambiguity always stops the line.
 *   - DONATIONS -> LGL GIFTS: each donation intake becomes an "In Kind" gift
 *     under the donor's constituent, valued at the intake estimate.
 *   - BORROWERS ARE OPTIONAL CONSTITUENTS: service recipients sync with a
 *     note, letting development staff see the closet's community impact.
 *   - IDEMPOTENT: rows already carrying an LGL id are skipped, so the nightly
 *     batch can run repeatedly without duplicating anything.
 */

// ---------------------------------------------------------------------------
// Sync log
// ---------------------------------------------------------------------------

function logSync_(direction, objectType, localId, lglId, action, status, httpStatus, message) {
  var sh = getSheet_('LGL_SyncLog');
  // Next id from the max existing SYN- suffix (robust to row deletion), never
  // below 100 so it always continues after the seeded fixtures.
  var syncId = 'SYN-' + Utilities.formatString('%04d', Math.max(100, maxIdSuffix_('LGL_SyncLog')) + 1);
  sh.appendRow([syncId, nowStamp_(), direction, objectType, localId,
                lglId || '', action, status, httpStatus || '', message || '']);
  return syncId;
}

// ---------------------------------------------------------------------------
// Constituent resolution (shared by donors and borrowers)
// ---------------------------------------------------------------------------

/**
 * Resolve a person (Donor or Borrower row object) to an LGL constituent id.
 * Returns { id, created, ambiguous, error }.
 */
function resolveConstituent_(person, objectType) {
  var search = LGL.searchConstituents(person.Email, person.FirstName + ' ' + person.LastName);

  if (!search.ok) {
    return { error: 'Search failed HTTP ' + search.httpStatus };
  }
  if (search.matches.length === 1) {
    return { id: search.matches[0].id, created: false };
  }
  if (search.matches.length > 1) {
    return { ambiguous: search.matches.length };
  }
  var created = LGL.createConstituent(person);
  if (!created.ok) {
    return { error: 'Create failed HTTP ' + created.httpStatus };
  }
  return { id: created.id, created: true };
}

// ---------------------------------------------------------------------------
// Donor + donation sync
// ---------------------------------------------------------------------------

/** Sync one donor row (by DonorID). Returns the LGL constituent id or null. */
function syncDonor(donorId) {
  var donors = readTable_('Donors');
  var donor = donors.filter(function (d) { return d.DonorID === donorId; })[0];
  if (!donor) throw new Error('Unknown donor ' + donorId);

  if (donor.LGLConstituentID) {                      // idempotency guard
    return String(donor.LGLConstituentID);
  }

  var res = resolveConstituent_(donor, 'Donor');

  if (res.ambiguous) {
    writeCell_('Donors', donor._rowIndex, 'LGLSyncStatus', 'Error');
    writeCell_('Donors', donor._rowIndex, 'LGLLastSyncAt', nowStamp_());
    logSync_('Push', 'Donor', donorId, '', 'Match Constituent (email)', 'Error', '300',
             'Multiple constituent matches (' + res.ambiguous + '); manual review required');
    return null;
  }
  if (res.error) {
    writeCell_('Donors', donor._rowIndex, 'LGLSyncStatus', 'Error');
    logSync_('Push', 'Donor', donorId, '', 'Sync Constituent', 'Error', '', res.error);
    return null;
  }

  writeCell_('Donors', donor._rowIndex, 'LGLConstituentID', res.id);
  writeCell_('Donors', donor._rowIndex, 'LGLSyncStatus', 'Synced');
  writeCell_('Donors', donor._rowIndex, 'LGLLastSyncAt', nowStamp_());
  logSync_('Push', 'Donor', donorId, res.id,
           res.created ? 'Create Constituent' : 'Match Constituent (email)',
           'Success', res.created ? '201' : '200',
           res.created ? 'New constituent created' : 'Matched existing constituent');
  return String(res.id);
}

/** Sync one donation (by DonationID) as an LGL in-kind gift. */
function syncDonationGift(donationId) {
  var donations = readTable_('Donations');
  var don = donations.filter(function (d) { return d.DonationID === donationId; })[0];
  if (!don) throw new Error('Unknown donation ' + donationId);

  if (don.LGLGiftID) return String(don.LGLGiftID);   // idempotency guard

  var constituentId = syncDonor(don.DonorID);        // ensures donor exists first
  if (!constituentId) {
    writeCell_('Donations', don._rowIndex, 'LGLSyncStatus', 'Error');
    logSync_('Push', 'Donation', donationId, '', 'Create Gift (in-kind $' + don.EstimatedValue + ')',
             'Skipped', '', 'Blocked: donor constituent unresolved');
    return null;
  }

  var gift = LGL.createGift(constituentId, don);
  if (!gift.ok) {
    writeCell_('Donations', don._rowIndex, 'LGLSyncStatus', 'Error');
    logSync_('Push', 'Donation', donationId, '', 'Create Gift', 'Error', gift.httpStatus, JSON.stringify(gift.body));
    return null;
  }

  writeCell_('Donations', don._rowIndex, 'LGLGiftID', gift.id);
  writeCell_('Donations', don._rowIndex, 'LGLSyncStatus', 'Synced');
  logSync_('Push', 'Donation', donationId, gift.id,
           'Create Gift (in-kind $' + don.EstimatedValue + ')', 'Success', '201',
           'Gift created under constituent ' + constituentId);
  return String(gift.id);
}

// ---------------------------------------------------------------------------
// Borrower sync (service-contact tracking)
// ---------------------------------------------------------------------------

function syncBorrower(borrowerId) {
  var borrowers = readTable_('Borrowers');
  var b = borrowers.filter(function (x) { return x.BorrowerID === borrowerId; })[0];
  if (!b) throw new Error('Unknown borrower ' + borrowerId);
  if (b.LGLConstituentID) return String(b.LGLConstituentID);

  var res = resolveConstituent_(b, 'Borrower');
  if (res.ambiguous || res.error) {
    writeCell_('Borrowers', b._rowIndex, 'LGLSyncStatus', 'Error');
    logSync_('Push', 'Borrower', borrowerId, '', 'Sync Constituent', 'Error',
             res.ambiguous ? '300' : '', res.error || ('Ambiguous: ' + res.ambiguous + ' matches'));
    return null;
  }

  writeCell_('Borrowers', b._rowIndex, 'LGLConstituentID', res.id);
  writeCell_('Borrowers', b._rowIndex, 'LGLSyncStatus', 'Synced');
  LGL.createNote(res.id, 'Loan Closet borrower record created via AppSheet prototype (' + borrowerId + ').');
  logSync_('Push', 'Borrower', borrowerId, res.id, 'Create Constituent (service contact)',
           'Success', '201', "Borrowers tracked as constituents w/ 'Loan Closet' group");
  return String(res.id);
}

// ---------------------------------------------------------------------------
// Batch entry points (time-driven trigger targets)
// ---------------------------------------------------------------------------

/**
 * Nightly batch: pushes every unsynced donor, donation, and borrower.
 * Install: Triggers > Add Trigger > nightlyLGLSync > time-driven > 2-3am.
 */
function nightlyLGLSync() {
  var pushed = { donors: 0, donations: 0, borrowers: 0 };

  readTable_('Donors').forEach(function (d) {
    if (!d.LGLConstituentID && d.LGLSyncStatus !== 'Error') {
      if (syncDonor(d.DonorID)) pushed.donors++;
    }
  });
  readTable_('Donations').forEach(function (d) {
    if (!d.LGLGiftID && d.LGLSyncStatus !== 'Error' && d.ReceiptSent === 'Y') {
      if (syncDonationGift(d.DonationID)) pushed.donations++;
    }
  });
  readTable_('Borrowers').forEach(function (b) {
    if (!b.LGLConstituentID && b.LGLSyncStatus !== 'Error') {
      if (syncBorrower(b.BorrowerID)) pushed.borrowers++;
    }
  });

  Logger.log('nightlyLGLSync complete: %s', JSON.stringify(pushed));
  return pushed;
}
