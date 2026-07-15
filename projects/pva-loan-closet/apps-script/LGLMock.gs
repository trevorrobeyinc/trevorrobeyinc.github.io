/**
 * LGLMock.gs — canned Little Green Light API responses for MOCK mode.
 *
 * Why this exists: the project brief requires demonstrating LGL integration
 * logic using mock/test data only. This module impersonates the LGL REST API
 * at the HTTP boundary, so LGLClient/SyncEngine run their REAL logic —
 * matching, creating, error-handling, logging — against realistic payloads.
 *
 * Response shapes mirror https://api.littlegreenlight.com/api-docs/static.html
 * (items arrays with paging metadata; created objects echoed back with ids).
 *
 * The mock directory below intentionally includes edge cases:
 *   - margaret.kowalski: exactly one match  -> "match existing" path
 *   - galdrich@example.com: TWO matches     -> ambiguous, sync must flag (300)
 *   - anyone else: zero matches             -> "create new constituent" path
 */

var LGLMock = (function () {
  var nextConstituentId = 302000; // ids above any fixture id
  var nextGiftId = 90000;
  var nextNoteId = 70000;

  /** Fixture constituents that "already exist in LGL". */
  var DIRECTORY = [
    {
      id: 301245, first_name: 'Margaret', last_name: 'Kowalski', is_org: false,
      email_addresses: [{ address: 'mkowalski62@example.com', email_address_type_id: 1 }],
      phone_numbers: [{ number: '(585) 555-0141' }],
      street_addresses: [{ street: '18 Stonecrest Dr', city: 'Pittsford', state: 'NY', postal_code: '14534' }]
    },
    {
      id: 301252, first_name: 'Raymond', last_name: 'Delgado', is_org: false,
      email_addresses: [{ address: 'ray.delgado@example.com', email_address_type_id: 1 }]
    },
    {
      id: 301260, first_name: 'Priya', last_name: 'Natarajan', is_org: false,
      email_addresses: [{ address: 'priya.n@example.com', email_address_type_id: 1 }]
    },
    { // George Aldrich exists TWICE (household + individual) -> ambiguous match case
      id: 301288, first_name: 'George', last_name: 'Aldrich', is_org: false,
      email_addresses: [{ address: 'galdrich@example.com', email_address_type_id: 1 }]
    },
    {
      id: 301292, first_name: 'George & Sue', last_name: 'Aldrich', is_org: false,
      email_addresses: [{ address: 'galdrich@example.com', email_address_type_id: 1 }]
    },
    {
      id: 301289, first_name: 'Linda', last_name: 'Tran', is_org: false,
      email_addresses: [{ address: 'linda.tran@example.com', email_address_type_id: 1 }]
    },
    {
      id: 301301, first_name: 'Beatrice', last_name: 'Munoz', is_org: false,
      email_addresses: [{ address: 'bmunoz@example.com', email_address_type_id: 1 }]
    }
  ];

  function paged_(items) {
    return { api_version: '1.0', items_count: items.length, total_items: items.length,
             limit: 25, offset: 0, items: items };
  }

  function searchByEmail_(email) {
    email = decodeURIComponent(email).toLowerCase();
    return DIRECTORY.filter(function (c) {
      return (c.email_addresses || []).some(function (e) {
        return e.address.toLowerCase() === email;
      });
    });
  }

  return {
    /**
     * Entry point called by LGLClient.request_ in MOCK mode.
     * Returns { httpStatus, ok, body } — identical contract to a live call.
     */
    handle: function (method, path, payload) {
      Utilities.sleep(120); // simulate network latency so demos feel honest

      // GET /constituents/search?q[]=email_address=...
      var m = path.match(/^\/constituents\/search\?q\[\]=email_address=(.+)$/);
      if (method === 'get' && m) {
        var found = searchByEmail_(m[1]);
        return { httpStatus: 200, ok: true, body: paged_(found) };
      }

      // GET /constituents/search?q[]=name=...
      m = path.match(/^\/constituents\/search\?q\[\]=name=(.+)$/);
      if (method === 'get' && m) {
        var name = decodeURIComponent(m[1]).toLowerCase();
        var hits = DIRECTORY.filter(function (c) {
          return (c.first_name + ' ' + c.last_name).toLowerCase().indexOf(name) !== -1 ||
                 name.indexOf(c.last_name.toLowerCase()) !== -1;
        });
        return { httpStatus: 200, ok: true, body: paged_(hits) };
      }

      // GET /constituents/{id}
      m = path.match(/^\/constituents\/(\d+)$/);
      if (method === 'get' && m) {
        var id = Number(m[1]);
        var hit = DIRECTORY.filter(function (c) { return c.id === id; })[0];
        return hit
          ? { httpStatus: 200, ok: true, body: hit }
          : { httpStatus: 404, ok: false, body: { error: 'Not Found' } };
      }

      // POST /constituents
      if (method === 'post' && path === '/constituents') {
        var created = JSON.parse(JSON.stringify(payload));
        created.id = nextConstituentId++;
        created.created_at = new Date().toISOString();
        DIRECTORY.push(created); // future searches in this run will match it
        return { httpStatus: 201, ok: true, body: created };
      }

      // POST /constituents/{id}/gifts
      m = path.match(/^\/constituents\/(\d+)\/gifts$/);
      if (method === 'post' && m) {
        var gift = JSON.parse(JSON.stringify(payload));
        gift.id = nextGiftId++;
        gift.constituent_id = Number(m[1]);
        gift.gift_type_id = 5; // fixture id for "In Kind"
        gift.created_at = new Date().toISOString();
        return { httpStatus: 201, ok: true, body: gift };
      }

      // POST /constituents/{id}/notes
      m = path.match(/^\/constituents\/(\d+)\/notes$/);
      if (method === 'post' && m) {
        var note = JSON.parse(JSON.stringify(payload));
        note.id = nextNoteId++;
        note.constituent_id = Number(m[1]);
        return { httpStatus: 201, ok: true, body: note };
      }

      return { httpStatus: 404, ok: false, body: { error: 'MOCK: unhandled route ' + method + ' ' + path } };
    }
  };
})();
