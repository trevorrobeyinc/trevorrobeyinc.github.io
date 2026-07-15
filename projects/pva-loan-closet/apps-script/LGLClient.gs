/**
 * LGLClient.gs — thin REST client for the Little Green Light (LGL) API.
 *
 * API reference: https://api.littlegreenlight.com/api-docs/static.html
 *   Base URL:  https://api.littlegreenlight.com/api/v1
 *   Auth:      HTTP Bearer token — Authorization: Bearer <api key>
 *              (LGL also supports basic auth and ?access_token=, but Bearer
 *               keeps the key out of URLs/logs.)
 *   Paging:    responses include { items_count, total_items, limit, offset, next_link }
 *
 * Endpoints used by this prototype:
 *   GET  /constituents/search?q[]=<query>          find donor/borrower by email or name
 *   POST /constituents                             create constituent
 *   POST /constituents/{id}/gifts                  record in-kind gift (donation)
 *   POST /constituents/{id}/notes                  attach loan/service notes
 *   GET  /constituents/{id}                        refresh a constituent record
 *
 * MOCK MODE (default for this exercise):
 *   Config!LGL_Mode = MOCK routes every call to LGLMock.gs, which returns
 *   fixtures with the same JSON shapes as the live API. This demonstrates the
 *   full integration logic with zero real/confidential data, per the project
 *   brief. Flipping Config!LGL_Mode to LIVE (plus an API key in Script
 *   Properties) switches to real HTTP calls with no code changes.
 *
 * NOTE before going LIVE: verify the exact /constituents/search query operator
 * syntax against the live sandbox (the dynamic docs let you try requests with
 * your own key); the mock layer accepts the documented "field=value" form.
 */

var LGL = (function () {

  /** Core request wrapper: auth header, JSON parsing, error surfacing. */
  function request_(method, path, payload) {
    var cfg = CFG.get();

    if (cfg.lglMode === 'MOCK') {
      return LGLMock.handle(method, path, payload); // same return shape as live
    }

    var options = {
      method: method,
      headers: {
        Authorization: 'Bearer ' + CFG.lglApiKey(),
        Accept: 'application/json'
      },
      muteHttpExceptions: true // we handle non-2xx ourselves
    };
    if (payload) {
      options.contentType = 'application/json';
      options.payload = JSON.stringify(payload);
    }

    var resp = UrlFetchApp.fetch(cfg.lglBaseUrl + path, options);
    var code = resp.getResponseCode();
    var body = {};
    try { body = JSON.parse(resp.getContentText() || '{}'); } catch (e) { /* non-JSON error page */ }

    return { httpStatus: code, ok: code >= 200 && code < 300, body: body };
  }

  return {
    /**
     * Find a constituent by email (exact) with name fallback.
     * Returns { matches: [...], httpStatus } — caller decides how to treat
     * 0 / 1 / many matches (see SyncEngine.resolveConstituent_).
     */
    searchConstituents: function (email, fullName) {
      var q = email
        ? 'email_address=' + encodeURIComponent(email)
        : 'name=' + encodeURIComponent(fullName || '');
      var r = request_('get', '/constituents/search?q[]=' + q);
      return { matches: (r.body && r.body.items) || [], httpStatus: r.httpStatus, ok: r.ok };
    },

    /** Create a constituent from our Donor/Borrower row. */
    createConstituent: function (person) {
      var payload = {
        first_name: person.FirstName,
        last_name: person.LastName,
        is_org: false,
        email_addresses: person.Email ? [{ address: person.Email, email_address_type_id: 1 }] : [],
        phone_numbers: person.Phone ? [{ number: person.Phone, phone_number_type_id: 1 }] : [],
        street_addresses: person.Street ? [{
          street: person.Street, city: person.City, state: person.State,
          postal_code: String(person.Zip), country: 'US'
        }] : []
      };
      var r = request_('post', '/constituents', payload);
      return { id: r.body && r.body.id, httpStatus: r.httpStatus, ok: r.ok, body: r.body };
    },

    /**
     * Record an in-kind gift against a constituent (donation intake).
     * LGL models donations as gifts nested under a constituent.
     */
    createGift: function (constituentId, donation) {
      var payload = {
        gift_type_name: 'In Kind',              // resolved to gift_type_id by LGL
        amount: Number(donation.EstimatedValue || 0),
        received_date: formatDateISO_(donation.DonationDate),
        note: 'Loan Closet equipment donation ' + donation.DonationID +
              ' (' + donation.ItemCount + ' item(s)). Logged by AppSheet prototype.'
      };
      var r = request_('post', '/constituents/' + constituentId + '/gifts', payload);
      return { id: r.body && r.body.id, httpStatus: r.httpStatus, ok: r.ok, body: r.body };
    },

    /** Attach a note (e.g., loan activity) to a constituent. */
    createNote: function (constituentId, text) {
      var payload = { note_type_name: 'General', text: text, original_date: formatDateISO_(new Date()) };
      var r = request_('post', '/constituents/' + constituentId + '/notes', payload);
      return { id: r.body && r.body.id, httpStatus: r.httpStatus, ok: r.ok };
    },

    /** Re-fetch one constituent (used by the nightly refresh pull). */
    getConstituent: function (constituentId) {
      var r = request_('get', '/constituents/' + constituentId);
      return { body: r.body, httpStatus: r.httpStatus, ok: r.ok };
    }
  };
})();

/** yyyy-MM-dd for LGL date fields. Accepts Date or string. */
function formatDateISO_(d) {
  return Utilities.formatDate(parseLocalDate_(d), CFG.get().timeZone, 'yyyy-MM-dd');
}
