# AppSheet Build Guide — PVA Mobility Equipment Loan Closet

Step-by-step assembly instructions for the working prototype. Follow top to bottom;
each section builds on the last. Budget ~2–3 hours for a first pass.

**Stack:** Google Sheets (backend) → AppSheet (app + event bots) → Apps Script (LGL sync,
scheduled notifications) → Little Green Light CRM (mock mode).

---

## 0. Prerequisites

1. A Google account. The free AppSheet tier covers **prototyping only** (the creator
   plus up to 10 explicitly-shared test users, undeployed). Running this for real staff
   needs a paid plan — see §12 for the cost and account-ownership decisions to make
   before deploying. For the interview build, the free tier is enough.
2. Upload `data/loan_closet_backend.xlsx` to Google Drive and **open with Google
   Sheets** (File → Save as Google Sheets). Rename the converted file
   `PVA Loan Closet Backend`. Delete the original .xlsx from Drive to avoid
   confusion — AppSheet must point at the *Google Sheets* version.
3. Confirm the 10 tabs exist: `_ReadMe`, `Equipment`, `Donors`, `Donations`,
   `Borrowers`, `Loans`, `SupportTickets`, `LGL_SyncLog`, `Lookups`, `Config`.

## 1. Deploy the Apps Script project (backend integration)

1. In the Google Sheet: **Extensions → Apps Script**.
2. Delete the default `Code.gs`. Create files matching `apps-script/` in this repo
   and paste contents: `Config.gs`, `LGLClient.gs`, `LGLMock.gs`, `SyncEngine.gs`,
   `WebhookHandler.gs`, `Notifications.gs`, `Tests.gs`.
3. Project Settings → check **Show "appsscript.json"** → replace its contents with
   `apps-script/appsscript.json`.
4. Script Properties (Project Settings → Script Properties):
   - `WEBHOOK_SHARED_SECRET` = any long random string (you'll reuse it in the bots).
   - `LGL_API_KEY` — leave unset; only needed if `Config!LGL_Mode` is flipped to `LIVE`.
5. Run `runAllTests` once from the editor (grant permissions). Expect **11/11 PASS**.
6. **Deploy → New deployment → Web app**: Execute as *Me*, access *Anyone*.
   Copy the Web App URL — the bots in §7 POST to it.
7. **Triggers** (clock icon): add time-driven triggers
   - `dailyLoanScan` — every day, 8–9am
   - `morningDigest` — every day, 7–8am
   - `nightlyLGLSync` — every day, 2–3am
8. Reload the spreadsheet: a **Loan Closet** menu appears (manual runs + tests).

## 2. Create the AppSheet app

1. Go to [appsheet.com](https://www.appsheet.com) → **Create → App → Start with
   existing data** → pick `PVA Loan Closet Backend`.
2. AppSheet imports one table; add the rest via **Data → Add Table**:
   `Equipment`, `Donors`, `Donations`, `Borrowers`, `Loans`, `SupportTickets`,
   `LGL_SyncLog`, `Lookups`, `Config`.
3. Table permissions (Data → table → Settings):
   | Table | Are updates allowed? |
   |---|---|
   | Equipment, Donors, Donations, Borrowers, Loans, SupportTickets | Updates + Adds |
   | LGL_SyncLog | **Read-Only** (script-owned audit trail) |
   | Lookups, Config | **Read-Only** (admin edits in the sheet) |

## 3. Column configuration (Data → each table)

AppSheet guesses most types; fix these explicitly.

### Keys and labels
| Table | Key | Label |
|---|---|---|
| Equipment | EquipmentID | AssetTag |
| Donors | DonorID | (virtual `FullName`, see below) |
| Donations | DonationID | DonationID |
| Borrowers | BorrowerID | (virtual `FullName`) |
| Loans | LoanID | LoanID |
| SupportTickets | TicketID | TicketID |

`Initial value` for every key column. **Recommended: `UNIQUEID()`** — it is
collision-safe under concurrent adds and needs no table scan. Use it for all six key
columns and you are done.

If you prefer human-readable sequential IDs that match the mock data (e.g. `EQ-0007`),
use a valid row-count expression — note `[_RowNumber]` is AppSheet's real system
column (there is no `[RowNum]`):

```
"EQ-" & RIGHT("0000" & (MAX(SELECT(Equipment[_RowNumber], TRUE)) + 1), 4)
```

Caveat (see §11): the sequential form can collide if an interior row was deleted, so
`UNIQUEID()` is the safer choice for anything beyond the demo. Pick one and keep it
consistent across tables.

### Refs (relationships)
| Column | Type | Ref table |
|---|---|---|
| Equipment.DonationID | Ref | Donations |
| Donations.DonorID | Ref | Donors |
| Loans.EquipmentID | Ref | Equipment |
| Loans.BorrowerID | Ref | Borrowers |
| SupportTickets.EquipmentID | Ref | Equipment |
| SupportTickets.LoanID | Ref | Loans |

AppSheet auto-creates reverse virtual columns (`Related Loans`, `Related
SupportTickets`, `Related Equipments`…) — keep them; detail views use them.

### Enums from Lookups
For each enum column, set Type = **Enum**, base type Text, and *Valid If*:

| Column | Valid If |
|---|---|
| Equipment.Category | `SELECT(Lookups[Value], [LookupType] = "Category")` |
| Equipment.Condition / Loans.ConditionOut / ConditionIn | `SELECT(Lookups[Value], [LookupType] = "Condition")` |
| Equipment.Status | `SELECT(Lookups[Value], [LookupType] = "EquipmentStatus")` |
| Loans.Status | `SELECT(Lookups[Value], [LookupType] = "LoanStatus")` |
| SupportTickets.Status | `SELECT(Lookups[Value], [LookupType] = "TicketStatus")` |
| SupportTickets.IssueType | `SELECT(Lookups[Value], [LookupType] = "IssueType")` |
| SupportTickets.Priority | `SELECT(Lookups[Value], [LookupType] = "Priority")` |
| SupportTickets.ReporterType | `SELECT(Lookups[Value], [LookupType] = "ReporterType")` |
| Equipment.AcquisitionType | `SELECT(Lookups[Value], [LookupType] = "AcquisitionType")` |

Storing enums in a Lookups *table* (not hardcoded in AppSheet) was a deliberate
design decision: staff can add a new equipment category by adding a row — no app
edit, no redeploy.

### Other column settings
- `Equipment.AssetTag` → type Text, **Searchable**, and enable **Scannable** (NFC/
  barcode) so the mobile camera can scan QR labels into forms.
- `Loans.CheckoutDate` initial value: `TODAY()`
- `Loans.DueDate` initial value:
  `TODAY() + LOOKUP("LoanPeriodDays", "Config", "Key", "Value")`
- `Loans.Status` initial value: `"Active"`
- `Donations.DonationDate` initial value: `TODAY()`
- `SupportTickets.OpenedAt` initial value: `NOW()`
- `SupportTickets.Status` initial value: `"New"`
- `Borrowers.WaiverOnFile` / `Donations.ReceiptSent` → type Yes/No (sheet stores Y/N;
  set the type's Yes/No values accordingly or use Enum {Y, N}).
- `Donors.Email`, `Borrowers.Email` → type Email; phones → type Phone.

### Virtual columns to add
| Table | Name | App formula |
|---|---|---|
| Donors | FullName | `[FirstName] & " " & [LastName]` |
| Borrowers | FullName | `[FirstName] & " " & [LastName]` |
| Loans | DaysToDue | `HOUR([DueDate] - TODAY()) / 24` |
| Loans | IsOverdue | `AND(ISBLANK([ReturnedDate]), [DueDate] < TODAY())` |
| Equipment | QRCodeImage | `CONCATENATE("https://quickchart.io/qr?size=200&text=", ENCODEURL([AssetTag]))` (type: Image) |
| Equipment | ActiveLoan | `ANY(SELECT(Loans[LoanID], AND([EquipmentID] = [_THISROW].[EquipmentID], IN([Status], LIST("Active","Overdue")))))` (type: Ref → Loans) |

`QRCodeImage` gives every item a scannable QR rendered right in its detail view —
print from there onto label stock, or wire PrintNode later (see Source Sheet).

## 4. Slices (Data → Slices)

| Slice | Source | Row filter condition |
|---|---|---|
| Available Equipment | Equipment | `[Status] = "Available"` |
| Open Loans | Loans | `IN([Status], LIST("Active", "Overdue"))` |
| Overdue Loans | Loans | `[Status] = "Overdue"` |
| Open Tickets | SupportTickets | `NOT(IN([Status], LIST("Resolved", "Closed")))` |
| Pending Receipts | Donations | `[ReceiptSent] <> "Y"` |
| Needs Attention | Equipment | `IN([Status], LIST("In Repair", "Quarantined", "In Cleaning"))` |

## 5. Views (UX → Views)

**Primary navigation (bottom bar):**
1. **Home** — dashboard view: interactive mode ON, panels = Overdue Loans (deck),
   Open Tickets (deck), Available Equipment summary (chart: count by Category),
   Pending Receipts (deck).
2. **Inventory** — deck view on Equipment, group by `Status` then `Category`,
   sort by AssetTag. Search + scan enabled.
3. **Loans** — deck view on Open Loans slice, sort by DueDate ascending,
   secondary view "History" (table, all Loans).
4. **Intake** — form view on Donations (the donation intake workflow entry point).
5. **Tickets** — deck view on Open Tickets, group by Priority (desc).

**Menu views:** Donors (table), Borrowers (table), Sync Log (table on LGL_SyncLog,
read-only, sort Timestamp desc), Config note (about page).

**Detail views:** enable "show related" so Equipment shows its loan/ticket history,
Donors show their donations, Borrowers show their loans.

## 6. Actions (Behavior → Actions)

### Check Out (the loan-origination one-tap)
On **Equipment**, visible when `[Status] = "Available"`:
- Action 1 `Start Loan` — *App: go to another view within this app* →
  `LINKTOFORM("Loans_Form", "EquipmentID", [EquipmentID])`
  (pre-fills the equipment; staff picks/creates the borrower, due date defaults).
- On **Loans form save**, Bot 2 (below) flips the equipment row to `On Loan` —
  keeping the status change server-side so it can never be skipped.

### Check In (equipment return)
On **Loans**, visible when `IN([Status], LIST("Active","Overdue"))`:
- Action `Return Item` — ***App: go to another view within this app*** →
  `LINKTOFORM("Loans_Return", "LoanID", [LoanID])`. Build the `Loans_Return`
  form view to show **only** `ConditionIn` (mark it **Required**) plus a read-only
  item summary.
- On that form set the **Form saved** column values (or the column initial values)
  so the whole return commits in **one** data change:
  `Status = "Returned"`, `ReturnedDate = TODAY()`, `CheckedInBy = USEREMAIL()`.
- **Why a form, not a one-tap set-columns action:** `ConditionIn` must be captured in
  the *same* update that flips `Status` to `Returned`. Otherwise Bot 3's repair-ticket
  step (which reads `[ConditionIn]` on the Status-change event) sees a blank condition
  and never creates the ticket. Capturing both together makes the return atomic.
- Bot 3 (below) then sets the Equipment row to `In Cleaning` and emails the
  thank-you — return-to-shelf becomes an explicit second step after sanitizing,
  which mirrors real loan-closet practice.

### Ticket shortcuts
On **Equipment**: `Report Issue` → `LINKTOFORM("SupportTickets_Form", "EquipmentID", [EquipmentID])`.
On **SupportTickets**, visible when open: `Mark Resolved` → set `Status = "Resolved"`,
`ResolvedAt = NOW()`.

### Donation receipt
On **Donations**, visible when `[ReceiptSent] <> "Y"`:
`Send Receipt` → set `ReceiptSent = "Y"`, `ReceiptSentAt = NOW()` → Bot 1 fires.

## 7. Automation (Automation → Bots)

> Shared setup for webhook steps: **Step type = Call a webhook**, URL = the Apps
> Script Web App URL from §1.6, HTTP Verb = POST, Body:
> ```json
> {
>   "action": "SYNC_DONATION",
>   "id": "<<[_THISROW].[DonationID]>>",
>   "secret": "YOUR-WEBHOOK-SHARED-SECRET"
> }
> ```

### Bot 1 — Donation Receipt + LGL Sync
- **Event:** Donations, Data change, *Updates only*,
  condition `AND([_THISROW_BEFORE].[ReceiptSent] <> "Y", [_THISROW_AFTER].[ReceiptSent] = "Y")`
- **Step 1 (Send an email):** To `LOOKUP([_THISROW].[DonorID], "Donors", "DonorID", "Email")`.
  Subject: `Thank you for your donation to the PVA Loan Closet`.
  Body template includes `<<[DonationID]>>`, `<<[DonationDate]>>`, `<<[ItemCount]>>`,
  `<<[EstimatedValue]>>` and the in-kind receipt language ("no goods or services
  were provided in exchange…").
- **Step 2 (Call a webhook):** `"action": "SYNC_DONATION"` — pushes donor +
  in-kind gift to LGL (mock), writes to LGL_SyncLog.

### Bot 2 — Loan Confirmation
- **Event:** Loans, Data change, *Adds only*.
- **Step 1 (Run a data action):** on the referenced Equipment row, set
  `Status = "On Loan"`.
- **Step 2 (Send an email):** to the borrower — item, asset tag, due date
  `<<[DueDate]>>`, care instructions, return address/hours.
- **Step 3 (Call a webhook):** `"action": "LOAN_NOTE"`, id `<<[_THISROW].[LoanID]>>`
  — stamps the borrower's LGL record with loan activity.

### Bot 3 — Return Processing
- **Event:** Loans, Data change, *Updates only*, condition
  `AND([_THISROW_BEFORE].[Status] <> "Returned", [_THISROW_AFTER].[Status] = "Returned")`
- **Step 1 (data action):** set referenced Equipment `Status = "In Cleaning"`.
- **Step 2 (email):** thank-you to borrower + "donations welcome" line
  (gentle development hook — this is why borrower records sync to LGL).
- **Step 3 (condition `[_THISROW_AFTER].[ConditionIn] = "Needs Repair"` → data action):**
  create a SupportTickets row (IssueType `Repair Needed`, Priority `Medium`).
  This fires correctly because the `Return Item` form (§6) sets `ConditionIn` in the
  same update that flips `Status` to `Returned`, so the condition can see it.

### Bot 4 — Ticket Alerts
- **Event:** SupportTickets, Data change, *Adds only*.
- **Step 1 (email):** to staff distro (Config!StaffAlertEmail) with ticket
  details; Subject prefix `[URGENT]` when `[Priority] = "Urgent"` via an IFS()
  in the subject template.
- **Step 2 (condition `[Priority] = "Urgent"` → Send a notification):** push
  notification to app users.

### Bot 5 — Overdue sweep (scheduled, AppSheet-native alternative)
The prototype's authoritative overdue engine is `dailyLoanScan` in Apps Script
(per-row cadence + escalation + ticket creation). To demonstrate AppSheet's
native scheduler as well, add:
- **Event:** Schedule, daily 08:00, ForEachRowInTable ON, table **Overdue Loans** slice.
- **Step (email):** overdue notice to `[BorrowerID].[Email]` referencing
  `<<[DueDate]>>` and `<<[EquipmentID].[Category]>>`.
Keep only one of the two enabled in production to avoid double-sending —
this prototype ships with the Apps Script version enabled and Bot 5 disabled
(documented in the Executive Summary as a design decision).

## 8. Format rules (UX → Format Rules)

| Rule | Table | Condition | Effect |
|---|---|---|---|
| Overdue red | Loans | `[Status] = "Overdue"` | red text + ⚠ icon |
| Due soon amber | Loans | `AND([Status]="Active", [DaysToDue] <= 7)` | orange text |
| Available green | Equipment | `[Status] = "Available"` | green highlight |
| Out of service grey | Equipment | `IN([Status], LIST("In Repair","Quarantined","Retired"))` | grey + 🔧 icon |
| Urgent ticket | SupportTickets | `[Priority] = "Urgent"` | red + bold |

## 9. Security & roles

- **Security → Require user signin:** ON (Google auth).
- Add a `Staff` table later for role granularity; for the prototype, all signed-in
  users are staff. Guard admin actions with
  `LOOKUP(USEREMAIL(), "Staff", "Email", "Role") = "Admin"` when that table exists.
- LGL_SyncLog, Lookups, Config are read-only in-app (set in §2.3).
- The LGL API key lives ONLY in Apps Script Script Properties — never in the
  sheet, never in AppSheet — so app users can't extract CRM credentials.

## 10. Test script (demo walkthrough)

Run these in order on the finished app — they exercise all four workflows:

0. **Pre-flight the webhook (do this before the interview, not on stage):** in the
   Apps Script editor, open the Web App URL in a browser — `doGet` should return
   `{"ok":true,...,"mode":"MOCK"}`. Then confirm Bot 1's webhook actually reaches it:
   run the §10.1 receipt step once and check LGL_SyncLog gains rows. If it doesn't, the
   webhook URL/secret/access is wrong — and the live fallback that produces the same log
   rows without the webhook is **Loan Closet menu → Run nightly LGL sync now**.

1. **Donation intake:** Intake tab → new Donation for donor Harold Weiss
   (DON-0014 pattern) → save → open it → `Send Receipt` action → check (a) email
   step fired in Automation monitor, (b) LGL_SyncLog gained `Create Constituent`
   + `Create Gift` rows (mock), (c) Donations row now shows LGLGiftID.
2. **Loan origination:** Inventory → scan/pick an Available walker →
   `Start Loan` → choose borrower → save → equipment flips to `On Loan`,
   borrower gets confirmation email (check Automation monitor).
3. **Equipment return:** Loans → pick the loan → `Return Item` → set ConditionIn
   `Needs Repair` → equipment flips `In Cleaning`, a repair ticket appears in
   Tickets, thank-you email fires.
4. **Support tickets:** Tickets → new ticket, Priority `Urgent` → staff email +
   push fire; `Mark Resolved` closes it out.
5. **Scheduled logic:** Sheet menu → Loan Closet → `Run daily loan scan now`. On the
   staged demo date this logs a **due-soon reminder for LN-00018** (the fixture due 7
   days out, with no reminder sent yet) and an **escalating overdue notice for LN-00013**
   (its previous notice is past the 7-day cadence, so its count ticks up). In MOCK mode
   these are written to LGL_SyncLog as `DryRun` rows rather than emailed. Then run
   `Run integration tests (mock)` → **11/11 PASS**. (Dates are relative — regenerate the
   backend with `data/generate_data.py` if the demo slips, and this step still holds.)

## 11. Known limitations (also in Executive Summary)

- Mock LGL layer approximates search-operator syntax; verify against the live
  API sandbox before flipping `LGL_Mode = LIVE`.
- Sequential human-readable IDs can collide under heavy concurrent adds;
  swap initial values to `UNIQUEID()` for production.
- Email steps use AppSheet's sender in the free tier; custom From requires a
  paid plan or the Apps Script MailApp path.
- No offline conflict-resolution policy set yet (AppSheet default last-write-wins).
- Photo columns exist but the prototype ships without seeded images.
- **QR images render from quickchart.io** (an external service) at view time. On a
  restricted/guest network the Inventory images may not load — pre-open the Inventory
  view before the demo, or keep a screenshot fallback. QR *scanning* also needs printed
  labels, so frame it as "labels print from here," not something scanned live.
- **MOCK mode only silences the Apps Script scheduled emails** (they log as `DryRun`).
  The four AppSheet *bot* emails (receipt, loan confirmation, return thank-you, ticket
  alert) are sent by AppSheet natively and are **not** gated by `LGL_Mode` — see §12.

## 12. Operating notes (interview talking points)

These are the operational questions a PVA Operations/IT interviewer is likely to ask.
None require code changes for the prototype; they show the design is deployment-aware.

- **What does it cost to run?** Google Sheets + Apps Script are free at this volume.
  AppSheet is the only cost: the free tier is prototype-only, so a real deployment needs
  a paid plan — **AppSheet Core is ~$10/user/month** (or is included with some Google
  Workspace editions). For ~15–20 volunteers that is roughly **$150–$200/month**, and it
  drops to near-zero if only a few staff accounts operate the app while volunteers hand
  items to them. Confirm current pricing at deploy time.
- **Whose Google account owns it?** The Sheet, the Apps Script (which runs "Execute as
  Me"), the three time triggers, the Web App, and the AppSheet app should all live under
  a **PVA-owned Google Workspace account** — ideally a shared/service account, not a
  volunteer's personal Gmail. Otherwise the automations stop and the data becomes
  inaccessible the day that person leaves. Document the owner and a transfer procedure.
- **Backup & recovery.** Google Drive keeps file version history on the Sheet (restore a
  bad edit from there). Additionally: turn on **protected ranges** for the `Config`,
  `Lookups`, and `LGL_SyncLog` tabs (they are read-only in the app but still editable in
  the raw Sheet), and schedule a periodic export/copy. A deleted row also matters because
  IDs are minted from the surviving rows — protected ranges prevent accidental deletes.
- **Email in the demo.** Because the AppSheet bot emails send for real regardless of
  `LGL_Mode`, point every bot's *To* at one inbox you control for the demo, so testing a
  receipt/confirmation can't email a fictional address. The scheduled Apps Script emails
  are already dry-run in MOCK.
- **Mobility-equipment liability.** The prototype tracks a `WaiverOnFile` flag and
  `WaiverDate`. A production step-up: attach the signed waiver PDF (a file/URL column, not
  just a flag), add assumption-of-risk language to the loan-confirmation email, and block
  an item from going `On Loan` until `WaiverOnFile = Y` and its condition is not
  `Needs Repair`. Worth naming explicitly since the lender is an ambulance service.
