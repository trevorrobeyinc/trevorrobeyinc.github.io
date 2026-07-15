#!/usr/bin/env python3
"""Generate the three Executive Summary diagrams as high-res PNGs."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import os

OUT = os.path.dirname(os.path.abspath(__file__))
NAVY = "#1F3864"; RED = "#9E1B1B"; GREEN = "#2E7D32"; ORANGE = "#C55A11"
GREY = "#5A5A5A"; LIGHT = "#F4F6F8"; INK = "#1A1A1A"
plt.rcParams.update({"font.family": "DejaVu Sans", "text.color": INK})


def box(ax, x, y, w, h, title, lines=(), fc="white", ec=NAVY, title_c=None, fs=10.5, lfs=8.6, lw=1.6):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.012,rounding_size=0.018",
                                fc=fc, ec=ec, lw=lw, mutation_aspect=1))
    cy = y + h - 0.055 if lines else y + h / 2
    ax.text(x + w / 2, cy, title, ha="center", va="center", fontsize=fs,
            fontweight="bold", color=title_c or ec)
    if lines:
        body = "\n".join(lines)
        ax.text(x + w / 2, y + (h - 0.11) / 2, body, ha="center", va="center",
                fontsize=lfs, color=INK, linespacing=1.45)


def arrow(ax, xy1, xy2, label="", color=GREY, style="-|>", ls="-", lp=0.5, dy=0.014, fs=8.2, curve=0.0):
    a = FancyArrowPatch(xy1, xy2, arrowstyle=style, mutation_scale=14, lw=1.5,
                        color=color, linestyle=ls, connectionstyle=f"arc3,rad={curve}",
                        shrinkA=4, shrinkB=4)
    ax.add_patch(a)
    if label:
        mx = xy1[0] + (xy2[0] - xy1[0]) * lp
        my = xy1[1] + (xy2[1] - xy1[1]) * lp + dy
        ax.text(mx, my, label, ha="center", va="bottom", fontsize=fs, color=color,
                bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none", alpha=0.9))


# ===========================================================================
# 1. SYSTEM ARCHITECTURE
# ===========================================================================
fig, ax = plt.subplots(figsize=(12.2, 6.4), dpi=200)
ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
ax.text(0.5, 0.965, "System Architecture — Mobility Equipment Loan Closet",
        ha="center", fontsize=14, fontweight="bold", color=NAVY)

# Users
box(ax, 0.02, 0.56, 0.17, 0.30, "Loan Closet Staff",
    ["AppSheet mobile + web app", "scan • intake • checkout", "return • tickets"], ec=NAVY)
box(ax, 0.02, 0.10, 0.17, 0.22, "Donors & Borrowers",
    ["email receipts,", "confirmations, reminders"], ec=GREY)

# AppSheet
box(ax, 0.255, 0.50, 0.225, 0.40, "Google AppSheet",
    ["Views: Home · Inventory · Loans", "Intake · Tickets",
     "Actions: Start Loan / Return /", "Send Receipt / Report Issue",
     "Bots 1–4: event automations", "(email + webhook steps)"], ec=NAVY, fc=LIGHT)

# Sheets
box(ax, 0.545, 0.56, 0.19, 0.34, "Google Sheets\n(system of record)",
    ["Equipment · Donors · Donations", "Borrowers · Loans · Tickets",
     "LGL_SyncLog · Lookups · Config"], ec=GREEN)

# Apps Script
box(ax, 0.545, 0.10, 0.19, 0.34, "Google Apps Script",
    ["Webhook receiver (doPost)", "LGL sync engine (idempotent)",
     "Scheduled: daily loan scan,", "morning digest, nightly sync",
     "Mock-mode test harness"], ec=ORANGE)

# LGL
box(ax, 0.80, 0.28, 0.18, 0.36, "Little Green Light\nCRM  (REST API)",
    ["constituents / search", "gifts (in-kind) · notes",
     "MOCK fixtures ↔ LIVE", "flag in Config"], ec=RED)

arrow(ax, (0.19, 0.71), (0.255, 0.71), "use app", lp=0.45)
arrow(ax, (0.48, 0.74), (0.545, 0.74), "sync data", lp=0.5)
arrow(ax, (0.48, 0.60), (0.545, 0.33), "bot webhook\n(POST + secret)", color=ORANGE, lp=0.55, dy=0.02, curve=0.12)
arrow(ax, (0.638, 0.56), (0.638, 0.44), "read/write\ntables + log", lp=0.5, dy=-0.005)
arrow(ax, (0.735, 0.20), (0.80, 0.31), "Bearer-auth\nREST · JSON", color=RED, lp=0.62, dy=-0.105, curve=-0.1)
arrow(ax, (0.545, 0.17), (0.195, 0.17), "MailApp: reminders,\noverdue notices, digest", color=GREY, lp=0.42, dy=0.012)
arrow(ax, (0.30, 0.50), (0.13, 0.32), "bot emails: receipts,\nconfirmations, alerts", color=GREY, lp=0.55, dy=0.02, curve=0.15)

ax.text(0.985, 0.03, "All data shown is fictional test data (LGL in MOCK mode).",
        ha="right", fontsize=7.5, color=GREY, style="italic")
fig.savefig(os.path.join(OUT, "architecture.png"), bbox_inches="tight",
            facecolor="white")
plt.close(fig)
print("architecture.png")

# ===========================================================================
# 2. DATA MODEL (ERD)
# ===========================================================================
fig, ax = plt.subplots(figsize=(12.2, 6.8), dpi=200)
ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
ax.text(0.5, 0.97, "Google Sheets Backend — Entity Relationships",
        ha="center", fontsize=14, fontweight="bold", color=NAVY)

def entity(x, y, w, h, name, keys, color=NAVY):
    box(ax, x, y, w, h, name, keys, ec=color, fs=10.5, lfs=8.2)

entity(0.03, 0.60, 0.175, 0.30, "Donors",
       ["PK DonorID", "name · contact · address", "LGLConstituentID", "LGLSyncStatus"], RED)
entity(0.27, 0.60, 0.185, 0.30, "Donations",
       ["PK DonationID", "FK DonorID", "date · items · est. value", "ReceiptSent · LGLGiftID"], RED)
entity(0.52, 0.58, 0.20, 0.34, "Equipment",
       ["PK EquipmentID", "AssetTag (QR)  ·  Category", "make/model/serial · size",
        "Condition · Status · location", "FK DonationID (nullable)"], GREEN)
entity(0.03, 0.13, 0.175, 0.30, "Borrowers",
       ["PK BorrowerID", "name · contact · address", "WaiverOnFile", "LGLConstituentID"], NAVY)
entity(0.27, 0.13, 0.185, 0.32, "Loans",
       ["PK LoanID", "FK EquipmentID", "FK BorrowerID", "checkout · due · returned",
        "Status · conditions in/out", "reminder + notice tracking"], NAVY)
entity(0.52, 0.10, 0.20, 0.32, "SupportTickets",
       ["PK TicketID", "FK EquipmentID (opt)", "FK LoanID (opt)",
        "issue · priority · status", "opened/resolved · assignee"], ORANGE)
entity(0.78, 0.58, 0.195, 0.30, "LGL_SyncLog",
       ["PK SyncID  (audit trail)", "direction · object · action", "status · HTTP · message",
        "appended by Apps Script"], GREY)
entity(0.78, 0.13, 0.195, 0.28, "Lookups & Config",
       ["enum values for dropdowns", "loan period · reminder days", "LGL mode (MOCK/LIVE)",
        "admin-only tabs"], GREY)

def rel(xy1, xy2, label, lp=0.5, dy=0.015, curve=0.0, color=GREY):
    arrow(ax, xy1, xy2, label, color=color, lp=lp, dy=dy, curve=curve, fs=8.4)

rel((0.205, 0.75), (0.27, 0.75), "1 ─ many", lp=0.5)
rel((0.455, 0.75), (0.52, 0.75), "1 ─ many\n(items in drop-off)", lp=0.5)
rel((0.205, 0.28), (0.27, 0.28), "1 ─ many", lp=0.5)
rel((0.455, 0.29), (0.52, 0.26), "1 ─ many\n(opt)", lp=0.55, curve=0.05)
rel((0.655, 0.58), (0.655, 0.42), "1 ─ many (service history)", lp=0.5, dy=-0.005)
rel((0.365, 0.45), (0.585, 0.575), "", curve=-0.12)
ax.text(0.40, 0.505, "each loan locks\nexactly one item", fontsize=8.4, color=GREY,
        ha="center", bbox=dict(boxstyle="round,pad=0.15", fc="white", ec="none"))

ax.text(0.5, 0.025, "Key rule enforced by the app layer: Equipment.Status = “On Loan”  ⇔  exactly one open row in Loans (Active/Overdue).",
        ha="center", fontsize=8.6, color=INK, style="italic")
fig.savefig(os.path.join(OUT, "erd.png"), bbox_inches="tight", facecolor="white")
plt.close(fig)
print("erd.png")

# ===========================================================================
# 3. WORKFLOWS (2x2)
# ===========================================================================
fig, axes = plt.subplots(2, 2, figsize=(14, 7.2), dpi=200)
fig.suptitle("Core Workflow Logic (shaded ⚡ steps are automated)", fontsize=14,
             fontweight="bold", color=NAVY, y=0.99)
fig.subplots_adjust(hspace=0.12, wspace=0.06, left=0.01, right=0.99, top=0.90, bottom=0.02)

def chain(ax, title, steps, color, note=""):
    ax.set_xlim(0, 1); ax.set_ylim(0, 1); ax.axis("off")
    ax.text(0.015, 0.90, title, fontsize=12, fontweight="bold", color=color)
    n = len(steps)
    gap = 0.030
    w = (0.97 - 0.015 - gap * (n - 1)) / n
    for i, s in enumerate(steps):
        x = 0.015 + i * (w + gap)
        auto = s.startswith("⚡")
        box(ax, x, 0.34, w, 0.40, "", fc=(LIGHT if auto else "white"),
            ec=(ORANGE if auto else color), lw=1.5)
        ax.text(x + w / 2, 0.545, s, ha="center", va="center", fontsize=7.6,
                color=INK, linespacing=1.4)
        if i < n - 1:
            arrow(ax, (x + w - 0.004, 0.545), (x + w + gap + 0.004, 0.545), color=GREY)
    if note:
        ax.text(0.015, 0.14, note, fontsize=8.4, color=GREY, style="italic")

chain(axes[0][0], "1 · Donation Intake",
      ["Donor arrives\nwith items", "Donation form\n(new / existing\ndonor)",
       "Tag items\n(QR AssetTag\nlabels)", "⚡ Receipt\nemail\nto donor",
       "⚡ LGL sync:\nconstituent\n+ in-kind gift"], RED,
      "Items become inventory rows linked to the donation; sync failures land in LGL_SyncLog.")
chain(axes[0][1], "2 · Loan Origination",
      ["Scan / pick\nAvailable item", "Start Loan\n(pre-filled\nform)",
       "Borrower +\nwaiver; due\ndate auto", "⚡ Item →\nOn Loan",
       "⚡ Confirm\nemail +\nLGL note"], NAVY,
      "Due date = today + Config LoanPeriodDays (90); staff can override per loan.")
chain(axes[1][0], "3 · Equipment Return",
      ["Item returned\nat base", "Return action\n(condition-in\ncheck)", "⚡ Item →\nIn Cleaning",
       "⚡ Thank-you\nemail\n(+ donate ask)", "⚡ Needs repair?\nauto-create\nticket"], GREEN,
      "Sanitize-then-shelve is explicit: cleaned items are flipped to Available manually.")
chain(axes[1][1], "4 · Support Tickets",
      ["Issue found\n(staff or\nborrower)", "Ticket form\n(links item\n/ loan)",
       "⚡ Staff alert\n(urgent →\npush)", "Assign; parts;\nrepair work",
       "Resolve →\nback in\nservice"], ORANGE,
      "Daily scan auto-escalates overdue loans into tickets after 2 unanswered notices.")

fig.savefig(os.path.join(OUT, "workflows.png"), bbox_inches="tight", facecolor="white")
plt.close(fig)
print("workflows.png")
