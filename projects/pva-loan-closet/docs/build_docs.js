/**
 * Builds the three written deliverables:
 *   1. Executive_Summary.docx  (≤5 pages, bullets + diagrams)
 *   2. Source_Sheet.docx       (1 page of resources)
 *   3. AI_Disclosure.docx      (1 page)
 */
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  ImageRun, LevelFormat, PageBreak, ExternalHyperlink, convertInchesToTwip,
} = require("docx");

const DIAG = path.join(__dirname, "..", "diagrams");
const NAVY = "1F3864", RED = "9E1B1B", GREY = "595959", GREEN = "2E7D32", ORANGE = "C55A11";
const FONT = "Arial";

// ---------------------------------------------------------------- helpers
const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [0, 1].map((lvl) => ({
        level: lvl,
        format: LevelFormat.BULLET,
        text: lvl === 0 ? "•" : "–",
        alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: convertInchesToTwip(0.28 + lvl * 0.28), hanging: convertInchesToTwip(0.16) } } },
      })),
    },
  ],
};

const t = (text, opts = {}) => new TextRun({ text, font: FONT, size: 20, ...opts });

const H1 = (text) => new Paragraph({
  heading: HeadingLevel.HEADING_1,
  spacing: { before: 220, after: 90 },
  children: [new TextRun({ text, font: FONT, size: 26, bold: true, color: NAVY })],
});
const H2 = (text, color = NAVY) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  spacing: { before: 160, after: 70 },
  children: [new TextRun({ text, font: FONT, size: 22, bold: true, color })],
});
const bullet = (runs, lvl = 0, opts = {}) => new Paragraph({
  numbering: { reference: "bullets", level: lvl },
  spacing: { after: 40 },
  children: (Array.isArray(runs) ? runs : [t(runs)]),
  ...opts,
});
const para = (runs, opts = {}) => new Paragraph({
  spacing: { after: 60 }, children: (Array.isArray(runs) ? runs : [t(runs)]), ...opts,
});
const img = (file, wIn, hIn) => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 60, after: 60 },
  children: [new ImageRun({
    type: "png",
    data: fs.readFileSync(path.join(DIAG, file)),
    transformation: { width: wIn * 96, height: hIn * 96 },
  })],
});
const caption = (text) => new Paragraph({
  alignment: AlignmentType.CENTER, spacing: { after: 100 },
  children: [t(text, { size: 16, italics: true, color: GREY })],
});

const cell = (children, w, opts = {}) => new TableCell({
  width: { size: w, type: WidthType.DXA },
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  ...opts,
  children,
});
const hcell = (text, w) => cell(
  [para([t(text, { bold: true, color: "FFFFFF", size: 19 })], { spacing: { after: 0 } })],
  w, { shading: { type: ShadingType.CLEAR, fill: NAVY } });

function twoColTable(headers, rows, w1, w2) {
  return new Table({
    columnWidths: [w1, w2],
    width: { size: w1 + w2, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: [hcell(headers[0], w1), hcell(headers[1], w2)] }),
      ...rows.map(([a, b], i) => new TableRow({
        children: [
          cell([para([t(a, { bold: true, size: 19 })], { spacing: { after: 0 } })], w1,
               i % 2 ? { shading: { type: ShadingType.CLEAR, fill: "F2F2F2" } } : {}),
          cell([para([t(b, { size: 19 })], { spacing: { after: 0 } })], w2,
               i % 2 ? { shading: { type: ShadingType.CLEAR, fill: "F2F2F2" } } : {}),
        ],
      })),
    ],
  });
}

const PAGE = { size: { width: 12240, height: 15840 },
               margin: { top: 720, bottom: 720, left: 864, right: 864 } }; // 0.5" top/bottom, 0.6" sides

const titleBlock = (title, subtitle) => [
  new Paragraph({
    spacing: { after: 30 },
    children: [new TextRun({ text: title, font: FONT, size: 34, bold: true, color: NAVY })],
  }),
  new Paragraph({
    spacing: { after: 10 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: RED, space: 4 } },
    children: [new TextRun({ text: subtitle, font: FONT, size: 20, color: GREY })],
  }),
  new Paragraph({ spacing: { after: 90 }, children: [] }),
];

// ============================================================ 1. EXEC SUMMARY
function execSummary() {
  const kids = [];
  kids.push(...titleBlock(
    "Mobility Equipment Loan Closet — Prototype Executive Summary",
    "Pittsford Volunteer Ambulance · Operations/IT project · AppSheet + Google Sheets + Apps Script + Little Green Light (mock) · July 2026"
  ));

  // ---- Overview
  kids.push(H1("1 · What Was Built"));
  kids.push(bullet([t("A working AppSheet prototype covering "), t("all four required workflows", { bold: true }),
                    t(": donation intake, loan origination, equipment return, and support ticket management.")]));
  kids.push(bullet([t("Backend: a 9-table Google Sheets workbook (36 equipment items, 10 donors, 14 donations, 14 borrowers, 19 loans, 9 tickets — all fictional test data). Dates are "), t("relative", { bold: true }), t(": the whole scenario is regenerated from one script for the actual demo date, so due-soon, overdue, and pending-sync states are always live and never go stale.")]));
  kids.push(bullet([t("Integration: a Google Apps Script layer that syncs donors → LGL constituents and donations → LGL in-kind gifts through the documented REST endpoints, running in a "), t("mock mode", { bold: true }),
                    t(" that mirrors real LGL response shapes (per the brief: no real or confidential data).")]));
  kids.push(bullet([t("Automation: 4 event bots in AppSheet (receipt, loan confirmation, return processing, ticket alerts) + 3 scheduled Apps Script jobs (daily loan scan, morning staff digest, nightly LGL sync), with an 11-test mock integration suite (11/11 passing).")]));

  kids.push(H1("2 · App Structure"));
  kids.push(img("architecture.png", 7.0, 3.67));
  kids.push(caption("Figure 1 — System architecture. AppSheet owns UX and event automation; Sheets is the system of record; Apps Script owns integration, secrets, and scheduled jobs."));
  kids.push(bullet([t("Views: "), t("Home dashboard (overdue / open tickets / inventory by category / pending receipts), Inventory (grouped deck, QR-scannable), Loans, Intake form, Tickets; admin views for Donors, Borrowers, and the read-only LGL sync log.", {})]));
  kids.push(bullet([t("One-tap actions: "), t("Start Loan (pre-filled from scanned item) · Return Item (condition-in check) · Send Receipt · Report Issue · Mark Resolved.")]));

  kids.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Page 2: data model
  kids.push(H1("3 · Backend Data Structure"));
  kids.push(img("erd.png", 7.0, 3.9));
  kids.push(caption("Figure 2 — Google Sheets backend: tables, key fields, and relationships (PK/FK via AppSheet Ref columns)."));
  kids.push(bullet([t("Each physical item is one Equipment row carrying a QR "), t("AssetTag", { bold: true }),
                    t(" — donations fan out 1-to-many into tagged inventory; loans lock exactly one item; tickets attach to items and optionally to loans.")]));
  kids.push(bullet([t("LGL_SyncLog is an append-only audit trail written by the sync engine — every push/pull, its HTTP status, and any error is inspectable in-app.")]));
  kids.push(bullet([t("Lookups & Config tabs drive all dropdowns and business rules (loan period, reminder windows, MOCK/LIVE flag) — staff change behavior by editing a row, not the app.")]));

  kids.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Page 3: workflows
  kids.push(H1("4 · Workflow Coverage"));
  kids.push(img("workflows.png", 7.1, 3.65));
  kids.push(caption("Figure 3 — The four core workflows; shaded steps run automatically (AppSheet bots or Apps Script)."));
  kids.push(H2("Notification logic implemented", GREY));
  kids.push(bullet("Donation receipt email on intake (with in-kind receipt language) → triggers LGL sync webhook."));
  kids.push(bullet("Loan confirmation email with due date at checkout; item auto-flips to On Loan server-side."));
  kids.push(bullet("Due-soon reminder 7 days before due (once); overdue notices on a 7-day cadence with escalating notice count; auto-escalation to a High-priority ticket after 2 unanswered notices."));
  kids.push(bullet("Return thank-you (with a soft donation ask); damaged returns auto-open repair tickets."));
  kids.push(bullet("New-ticket staff alerts (Urgent priority also sends an app push); daily 7am staff digest summarizing overdue loans, open tickets, pending receipts, and pending syncs."));

  kids.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Page 4: design decisions
  kids.push(H1("5 · Key Design Decisions & Rationale"));
  kids.push(twoColTable(["Decision", "Why"], [
    ["Three-layer split: AppSheet = UX + event bots · Sheets = system of record · Apps Script = integration + schedules",
     "Each tool does only what it is best at; Sheets and Apps Script are free at this volume and any layer can be upgraded (e.g., Sheets → Cloud SQL) without rebuilding the others (AppSheet deployment cost noted in §7)."],
    ["LGL credentials live only in Apps Script Script Properties; AppSheet bots call a secret-checked webhook",
     "App users can never extract the CRM API key; one server-side integration surface serves the webhook, the nightly batch, and manual menu runs — and is testable in isolation."],
    ["Match-before-create LGL sync: search by email → 1 match links, 0 creates, 2+ stops with an Error status for human review",
     "Duplicate constituents are the classic CRM-integration failure; the prototype includes a deliberate ambiguous-donor fixture to prove the guardrail works."],
    ["Mock mode as a first-class Config flag (MOCK/LIVE), with fixtures mirroring real LGL JSON at the HTTP boundary",
     "The brief requires mock data only — the real sync logic (matching, gifts, errors, logging) still executes end-to-end, and go-live is a config flip plus an API key, not a rewrite."],
    ["Idempotent sync + append-only sync log",
     "Rows already carrying LGL IDs are skipped, so batches can re-run safely after failures; every action is auditable in-app."],
    ["Returns flip items to In Cleaning, not Available",
     "Mirrors real loan-closet hygiene practice — sanitize-then-shelve becomes an explicit, trackable step."],
    ["Event notifications in AppSheet bots; scheduled notifications in Apps Script (AppSheet's native scheduled bot included but disabled)",
     "Per-row cadence tracking (last-reminder timestamps, escalating notice counts) needs date math AppSheet schedules handle poorly; a single-owner rule prevents double-sending."],
    ["Enums stored in a Lookups table, not hardcoded in the app",
     "Staff add a new equipment category by adding a row — no app edit, no redeploy."],
  ], 4300, 6100));

  kids.push(new Paragraph({ children: [new PageBreak()] }));

  // ---- Page 5: challenges + limitations
  kids.push(H1("6 · Technical Challenges & How They Were Addressed"));
  kids.push(twoColTable(["Challenge", "Response"], [
    ["Demonstrating a real CRM integration with no LGL account or real data",
     "Built a mock LGL service behind the same client interface (identical JSON shapes, paging metadata, status codes incl. 404/300 paths); an 11-test suite exercises match/create/gift/note/error flows plus date, ID-minting, and webhook-auth regression checks — 11/11 passing."],
    ["Duplicate-donor risk when pushing to LGL",
     "Search-first resolution with an explicit ambiguous branch that halts, flags the donor row, and logs for review (seeded fixture DNR-008 demonstrates it live)."],
    ["Keeping Equipment.Status and Loans consistent (a skipped manual step would corrupt inventory)",
     "Status flips happen in bot data-actions on loan add/return — server-side, so they cannot be skipped; the invariant (On Loan ⇔ exactly one open loan) is asserted in the dataset generator and documented for the app layer."],
    ["Double-notification risk with two automation engines",
     "Single-owner rule per notification type; the AppSheet-native overdue bot ships disabled with the rationale documented."],
    ["AppSheet formula limits for cadence logic (send every N days, escalate after 2 notices)",
     "Moved cadence state into columns (LastReminderSentAt, OverdueNoticeCount) maintained by the daily Apps Script scan — testable, inspectable, and adjustable via Config."],
  ], 4300, 6100));

  kids.push(H1("7 · Limitations & Next Steps"));
  kids.push(bullet("Verify LGL search-operator syntax and gift-type IDs against a live sandbox account before flipping LGL_Mode to LIVE (mock approximates the documented forms)."));
  kids.push(bullet("Add a Staff table for role-based permissions (admin vs volunteer) and per-user audit stamps on actions."));
  kids.push(bullet("Label printing: QR images render in-app today (quickchart.io); next step is one-tap thermal label output via PrintNode or a Google Docs label-merge template."));
  kids.push(bullet("Seed equipment photos; add condition-photo capture on return to strengthen damage tickets."));
  kids.push(bullet("Reporting: monthly KPI view (loans out, turnaround time, donation value) exportable for the board; optional LGL volunteer-hours sync."));
  kids.push(bullet("Production hardening: switch human-readable IDs to UNIQUEID(), define offline-edit conflict policy, and set a data-retention window for borrower records."));
  kids.push(bullet([t("Cost & ownership: ", { bold: true }), t("Sheets + Apps Script are free at this volume; AppSheet is the deployment cost (Core ≈ $10/user/mo, ~$150–200/mo for 15–20 users, less if only staff accounts operate the app). Own the Sheet, Script, and app under a PVA Google Workspace account — not a personal one — so automations and data survive staff turnover.")]));
  kids.push(bullet([t("Data protection: ", { bold: true }), t("enable Drive version history plus protected ranges on the Config, Lookups, and LGL_SyncLog tabs, and a periodic export, so an accidental edit or deletion in the raw Sheet is recoverable.")]));
  kids.push(bullet([t("Liability: ", { bold: true }), t("step up the waiver flag to a stored signed-waiver file, add assumption-of-risk language to the loan email, and block checkout until a waiver is on file and the item is not flagged for repair.")]));

  return new Document({
    numbering,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: PAGE }, children: kids }],
  });
}

// ============================================================ 2. SOURCE SHEET
function sourceSheet() {
  const link = (label, url) => new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 30 },
    children: [
      t(label + " — ", { bold: true, size: 19 }),
      new ExternalHyperlink({
        children: [new TextRun({ text: url, font: FONT, size: 18, color: "0563C1", underline: {} })],
        link: url,
      }),
    ],
  });
  const note = (text) => new Paragraph({
    numbering: { reference: "bullets", level: 1 }, spacing: { after: 40 },
    children: [t(text, { size: 18, color: GREY })],
  });

  const kids = [];
  kids.push(...titleBlock("Source Sheet — Public Resources & Documentation",
    "Mobility Equipment Loan Closet prototype · all resources public · no confidential or internal data used"));

  kids.push(H2("Little Green Light (LGL) API", RED));
  kids.push(link("LGL REST API reference (static)", "https://api.littlegreenlight.com/api-docs/static.html"));
  kids.push(note("Authentication (Bearer token), constituent search/create, paging metadata; basis for the sync client and mock fixtures."));
  kids.push(link("LGL interactive API docs", "https://api.littlegreenlight.com/api-docs/"));
  kids.push(link("LGL Knowledge Base — Using the LGL API (for developers)", "https://help.littlegreenlight.com/article/603-for-software-developers-using-the-lgl-api"));
  kids.push(link("LGL API Terms of Use", "https://www.littlegreenlight.com/api-terms/"));

  kids.push(H2("Google AppSheet"));
  kids.push(link("Bots: The Essentials", "https://support.google.com/appsheet/answer/11432969"));
  kids.push(link("Call a webhook from an automation", "https://support.google.com/appsheet/answer/11511244"));
  kids.push(link("Introduction to webhooks", "https://support.google.com/appsheet/answer/11511009"));
  kids.push(link("Call Apps Script from an automation", "https://support.google.com/appsheet/answer/11997142"));
  kids.push(note("Used to choose between the webhook step and the native Apps Script task step; the prototype uses the webhook + shared-secret pattern."));
  kids.push(link("Codelab: Connect AppSheet with Apps Script", "https://codelabs.developers.google.com/appsheet-appsscript"));

  kids.push(H2("Google Apps Script", GREEN));
  kids.push(link("Apps Script reference (UrlFetchApp, PropertiesService, MailApp, triggers)", "https://developers.google.com/apps-script/reference"));
  kids.push(link("Web Apps (doGet/doPost deployment)", "https://developers.google.com/apps-script/guides/web"));

  kids.push(H2("Labels, QR codes & printing", ORANGE));
  kids.push(link("QuickChart QR API (in-app QR rendering for asset tags)", "https://quickchart.io/documentation/qr-codes/"));
  kids.push(link("PrintNode remote printing API (next-step thermal label printing)", "https://www.printnode.com/en"));
  kids.push(link("AppSheet community: printing barcode labels", "https://www.googlecloudcommunity.com/gc/AppSheet-Q-A/How-to-Print-Barcode-Labels/td-p/610706"));

  kids.push(H2("Organizational context", GREY));
  kids.push(link("Pittsford Volunteer Ambulance — services & Loan Closet program", "https://pittsfordambulance.org/"));

  return new Document({
    numbering,
    styles: { default: { document: { run: { font: FONT, size: 19 } } } },
    sections: [{ properties: { page: PAGE }, children: kids }],
  });
}

// ============================================================ 3. AI DISCLOSURE
function aiDisclosure() {
  const kids = [];
  kids.push(...titleBlock("AI Disclosure",
    "Mobility Equipment Loan Closet prototype · July 2026"));

  kids.push(para([t("I used an AI assistant (Claude, by Anthropic) as a development accelerator on this project, in the same way I would use it on the job. Specifics below.", { size: 20 })]));

  kids.push(H2("Where AI was used"));
  kids.push(bullet("Drafting the initial Google Sheets data model and generating the fictional test dataset (donors, borrowers, equipment, loans, tickets) with consistent cross-references."));
  kids.push(bullet("Drafting the Apps Script code for the LGL API client, mock-mode fixtures, sync engine, webhook receiver, and scheduled notification jobs."));
  kids.push(bullet("Producing the diagrams and first drafts of this document set (executive summary, source sheet, build guide)."));

  kids.push(H2("My role"));
  kids.push(bullet("Set the project's direction and requirements, and reviewed and approved every design decision — three-layer architecture, match-before-create sync, mock-mode flag, and the notification-ownership split."));
  kids.push(bullet("Assemble, configure, and own the AppSheet application itself (tables, refs, slices, views, actions, format rules, automation bots) and stand up the Apps Script deployment — web app, webhook, and time-driven triggers — following the included build guide. The AI produced the backend and the Apps Script source; the running app is mine to build and operate."));
  kids.push(bullet("Verify the workflows end-to-end (intake → receipt → sync; checkout → return; ticket lifecycle) as I build; the mock integration test suite passes 11/11 with no network calls in mock mode, and I own resolving anything that diverges."));
  kids.push(bullet("Final editing and ownership of all written deliverables."));

  kids.push(H2("Verification & data integrity"));
  kids.push(bullet("All data is fictional test data generated for this exercise; no real donor, patient, borrower, or organizational data was used anywhere, and the LGL integration ran exclusively against local mock fixtures — no live CRM was accessed."));
  kids.push(bullet("Referential integrity of the mock dataset is enforced by scripted checks (every loan ↔ item ↔ borrower link verified; donation item counts reconcile to tagged inventory)."));

  kids.push(new Paragraph({ spacing: { before: 160, after: 0 },
    children: [t("I'm glad to walk through any part of the build — including the parts AI accelerated — in as much depth as useful.", { italics: true, size: 20 })] }));

  return new Document({
    numbering,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: PAGE }, children: kids }],
  });
}

// ---------------------------------------------------------------- write all
(async () => {
  for (const [name, doc] of [
    ["Executive_Summary.docx", execSummary()],
    ["Source_Sheet.docx", sourceSheet()],
    ["AI_Disclosure.docx", aiDisclosure()],
  ]) {
    const buf = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(__dirname, name), buf);
    console.log("wrote", name);
  }
})();
