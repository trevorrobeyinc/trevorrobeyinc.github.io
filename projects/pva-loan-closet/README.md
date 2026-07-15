# PVA Mobility Equipment Loan Closet — AppSheet Prototype

Take-home project package: Google AppSheet + Google Sheets + Apps Script with a
mock-mode Little Green Light (LGL) CRM integration, for Pittsford Volunteer
Ambulance's equipment loan closet.

## Package contents

```
pva-loan-closet/
├── data/
│   ├── loan_closet_backend.xlsx  ← IMPORT THIS to Google Sheets (9 tables + ReadMe)
│   ├── csv/                      ← same tables as individual CSVs
│   └── generate_data.py          ← regenerates the dataset (integrity-checked)
├── apps-script/                  ← paste into Extensions → Apps Script
│   ├── appsscript.json           ← manifest (scopes, webapp config)
│   ├── Config.gs                 ← sheet config + Script Properties (secrets)
│   ├── LGLClient.gs              ← LGL REST client (Bearer auth)
│   ├── LGLMock.gs                ← mock LGL API (fixtures incl. edge cases)
│   ├── SyncEngine.gs             ← match-before-create sync + audit log
│   ├── WebhookHandler.gs         ← doPost receiver for AppSheet bots
│   ├── Notifications.gs          ← daily loan scan, overdue cadence, digest
│   └── Tests.gs                  ← 8 mock integration tests
├── docs/
│   ├── AppSheet_Build_Guide.md   ← step-by-step app assembly (§0–§11)
│   ├── Executive_Summary.docx/pdf   (deliverable, 5 pp)
│   ├── Source_Sheet.docx/pdf        (deliverable, 1 p)
│   ├── AI_Disclosure.docx/pdf       (deliverable, 1 p)
│   └── build_docs.js             ← regenerates the three documents
└── diagrams/
    ├── architecture.png · erd.png · workflows.png
    └── make_diagrams.py
```

## Fastest path to a working prototype

1. `data/loan_closet_backend.xlsx` → Google Drive → open as Google Sheets.
2. Follow `docs/AppSheet_Build_Guide.md` top to bottom (§1 Apps Script ≈ 20 min,
   §2–§9 AppSheet ≈ 2–3 h, §10 test script ≈ 20 min).
3. Submit the three documents in `docs/` + prototype access.

All data is fictional test data; the LGL integration runs in MOCK mode by
design (see `Config` tab). Going live later = API key in Script Properties +
`LGL_Mode = LIVE`.
