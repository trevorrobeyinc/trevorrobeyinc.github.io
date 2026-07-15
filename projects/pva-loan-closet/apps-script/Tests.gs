/**
 * Tests.gs — mock-mode integration tests for the LGL sync engine.
 *
 * Run from the spreadsheet menu (Loan Closet > Run integration tests) or the
 * Apps Script editor. All tests run against LGLMock — no network calls, no
 * real data — and they do NOT write to the data tabs (pure-client tests) so
 * they are safe to run any time, including during a live demo.
 *
 * Results are written to the execution log AND returned as a summary string.
 */

function runAllTests() {
  var results = [];
  function t(name, fn) {
    try {
      fn();
      results.push('PASS  ' + name);
    } catch (err) {
      results.push('FAIL  ' + name + ' -> ' + err);
    }
  }
  function assertEq(actual, expected, label) {
    if (actual !== expected) throw new Error((label || '') + ' expected ' + expected + ' got ' + actual);
  }
  function assertTrue(v, label) { if (!v) throw new Error(label || 'expected truthy'); }

  // -------------------------------------------------------------------
  t('search: known donor email returns exactly 1 match', function () {
    var r = LGL.searchConstituents('mkowalski62@example.com', 'Margaret Kowalski');
    assertEq(r.httpStatus, 200, 'status');
    assertEq(r.matches.length, 1, 'match count');
    assertEq(r.matches[0].id, 301245, 'constituent id');
  });

  t('search: unknown email returns 0 matches (create path)', function () {
    var r = LGL.searchConstituents('nobody@nowhere.example', 'No Body');
    assertEq(r.matches.length, 0, 'match count');
  });

  t('search: duplicate email returns 2 matches (ambiguous path)', function () {
    var r = LGL.searchConstituents('galdrich@example.com', 'George Aldrich');
    assertEq(r.matches.length, 2, 'match count'); // household + individual fixture
  });

  t('create constituent: returns 201 + new id, then is findable', function () {
    var person = { FirstName: 'Test', LastName: 'Donor', Email: 'test.donor@example.com',
                   Phone: '(585) 555-0000', Street: '1 Main St', City: 'Pittsford',
                   State: 'NY', Zip: '14534' };
    var c = LGL.createConstituent(person);
    assertEq(c.httpStatus, 201, 'status');
    assertTrue(c.id >= 302000, 'new id range');
    var again = LGL.searchConstituents('test.donor@example.com', 'Test Donor');
    assertEq(again.matches.length, 1, 'findable after create');
  });

  t('create gift: in-kind gift posts under constituent', function () {
    var g = LGL.createGift(301245, { DonationID: 'DON-TEST', EstimatedValue: 123,
                                     DonationDate: '2026-07-13', ItemCount: 2 });
    assertEq(g.httpStatus, 201, 'status');
    assertEq(g.body.constituent_id, 301245, 'constituent linkage');
    assertEq(g.body.amount, 123, 'amount');
    assertEq(g.body.gift_type_id, 5, 'in-kind type resolved');
  });

  t('create note: attaches to constituent', function () {
    var n = LGL.createNote(301260, 'Test loan activity note');
    assertEq(n.httpStatus, 201, 'status');
    assertTrue(n.ok, 'ok flag');
  });

  t('get constituent: 404 on unknown id', function () {
    var r = LGL.getConstituent(999999);
    assertEq(r.httpStatus, 404, 'status');
    assertTrue(!r.ok, 'not ok');
  });

  t('config: mock mode is active for this test run', function () {
    assertEq(CFG.get().lglMode, 'MOCK', 'LGL_Mode');
  });

  // --- regression tests for the date/id/webhook fixes ----------------
  t('date: yyyy-MM-dd is not shifted a day by UTC parsing', function () {
    // Regression guard for the "one calendar day early" bug: a text date must
    // round-trip to the same day in the org timezone, not the day before.
    assertEq(formatDateISO_('2026-07-20'), '2026-07-20', 'formatDateISO_ round-trip');
    var d = parseLocalDate_('2026-07-20');
    assertEq(d.getFullYear(), 2026, 'year');
    assertEq(d.getMonth(), 6, 'month (0-based July)');
    assertEq(d.getDate(), 20, 'day of month');
  });

  t('ids: next minted ticket id exceeds every existing suffix', function () {
    // Regression guard for getLastRow()-based minting colliding after a
    // mid-table row deletion. read-only: does not write a ticket.
    var mintId = 'TKT-' + Utilities.formatString('%04d', maxIdSuffix_('SupportTickets') + 1);
    var existing = readTable_('SupportTickets').map(function (r) { return r.TicketID; });
    assertTrue(existing.indexOf(mintId) === -1, 'minted id ' + mintId + ' already exists');
  });

  t('webhook: rejects a POST with a wrong/absent shared secret (fail-closed)', function () {
    // Wrong secret => guard returns before any dispatch, so no sheet write.
    var e = { postData: { contents: JSON.stringify(
      { action: 'SYNC_DONOR', id: 'DNR-001', secret: 'wrong-secret-xyz' }) } };
    var res = JSON.parse(doPost(e).getContent());
    assertEq(res.httpStatus, 401, 'unauthorized status');
    assertTrue(res.ok === false, 'ok flag is false');
  });

  // -------------------------------------------------------------------
  var summary = results.join('\n');
  var passes = results.filter(function (r) { return r.indexOf('PASS') === 0; }).length;
  var header = passes + '/' + results.length + ' tests passed (' + nowStamp_() + ')\n';
  Logger.log(header + summary);

  try { // show in a dialog when run from the menu
    SpreadsheetApp.getUi().alert('LGL Integration Tests', header + '\n' + summary,
                                 SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { /* headless run — log only */ }

  return header + summary;
}
