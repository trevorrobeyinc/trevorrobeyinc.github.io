#!/usr/bin/env python3
"""
Generate the mock backend dataset for the PVA Loan Closet AppSheet prototype.
Deterministic (hand-authored rows) so referential integrity is guaranteed.
Outputs: loan_closet_backend.xlsx (one tab per table) + individual CSVs.

Demo staging: every hand-authored date is written against ANCHOR (2026-07-13).
At generation time the WHOLE timeline is shifted by (DEMO_DATE - ANCHOR) days,
so the staged scenario (3 overdue, 1 due-soon, pending syncs, ambiguous-donor
error, tickets in every status) is always correct RELATIVE TO the demo date and
never decays. DEMO_DATE defaults to today; override it for a known interview
date via the env var or first CLI arg, e.g.:
    DEMO_DATE=2026-08-15 python3 generate_data.py
    python3 generate_data.py 2026-08-15
"""
import csv, os, re, sys
from datetime import date, datetime, timedelta
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = os.path.dirname(os.path.abspath(__file__))
CSV_DIR = os.path.join(OUT, "csv")
os.makedirs(CSV_DIR, exist_ok=True)

# ----------------------------------------------------------------------------
# Demo-date staging (relative dates)
# ----------------------------------------------------------------------------
ANCHOR = date(2026, 7, 13)
_demo = os.environ.get("DEMO_DATE", "").strip() or (sys.argv[1].strip() if len(sys.argv) > 1 else "")
DEMO_DATE = date.fromisoformat(_demo) if _demo else date.today()
SHIFT = (DEMO_DATE - ANCHOR).days

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}( \d{2}:\d{2})?$")

def sd(v):
    """Shift an ISO date/datetime string by SHIFT days; pass anything else through."""
    if not isinstance(v, str) or not _DATE_RE.match(v):
        return v
    if len(v) == 10:
        return (date.fromisoformat(v) + timedelta(days=SHIFT)).isoformat()
    return (datetime.strptime(v, "%Y-%m-%d %H:%M") + timedelta(days=SHIFT)).strftime("%Y-%m-%d %H:%M")

def md(anchor_offset):
    """'M/D' label for a prose note referring to a date at ANCHOR+offset, post-shift."""
    d = ANCHOR + timedelta(days=anchor_offset + SHIFT)
    return f"{d.month}/{d.day}"

def shift_rows(rows):
    """Translate every ISO date/datetime cell in a table by SHIFT days, in place."""
    for r in rows:
        for j, v in enumerate(r):
            r[j] = sd(v)
    return rows

# ----------------------------------------------------------------------------
# LOOKUPS
# ----------------------------------------------------------------------------
lookups_header = ["LookupType", "Value", "SortOrder", "Active"]
CATEGORIES = ["Wheelchair", "Transport Chair", "Rollator", "Walker", "Knee Scooter",
              "Crutches", "Cane", "Quad Cane", "Shower Chair", "Tub Transfer Bench",
              "Bedside Commode", "Raised Toilet Seat", "Toilet Safety Frame"]
CONDITIONS = ["New", "Excellent", "Good", "Fair", "Needs Repair"]
EQ_STATUS = ["Available", "On Loan", "In Cleaning", "In Repair", "Quarantined", "Retired"]
LOAN_STATUS = ["Active", "Overdue", "Returned", "Lost"]
TKT_STATUS = ["New", "In Progress", "Waiting on Parts", "Resolved", "Closed"]
ISSUE_TYPES = ["Repair Needed", "Cleaning Required", "Missing Part", "Damage Reported",
               "Overdue Follow-up", "Donation Question", "App/Data Issue", "Other"]
PRIORITIES = ["Low", "Medium", "High", "Urgent"]
REPORTER_TYPES = ["Borrower", "Donor", "Staff", "Volunteer"]
ACQ_TYPES = ["Donated", "Purchased"]

lookups_rows = []
for typ, vals in [("Category", CATEGORIES), ("Condition", CONDITIONS),
                  ("EquipmentStatus", EQ_STATUS), ("LoanStatus", LOAN_STATUS),
                  ("TicketStatus", TKT_STATUS), ("IssueType", ISSUE_TYPES),
                  ("Priority", PRIORITIES), ("ReporterType", REPORTER_TYPES),
                  ("AcquisitionType", ACQ_TYPES)]:
    for i, v in enumerate(vals, 1):
        lookups_rows.append([typ, v, i, "Y"])

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------
config_header = ["Key", "Value", "Description"]
config_rows = [
    ["LoanPeriodDays", "90", "Default loan period; DueDate = CheckoutDate + this many days"],
    ["ReminderDaysBeforeDue", "7", "Send 'due soon' reminder this many days before DueDate"],
    ["OverdueReminderEveryDays", "7", "Repeat overdue notices at this cadence"],
    ["ClosetEmail", "loancloset.demo@example.org", "From/reply-to address for borrower emails (MOCK)"],
    ["StaffAlertEmail", "opsdesk.demo@example.org", "Staff distro for ticket + overdue alerts (MOCK)"],
    ["LGL_Mode", "MOCK", "MOCK = use canned LGL fixtures; LIVE = call api.littlegreenlight.com"],
    ["LGL_BaseUrl", "https://api.littlegreenlight.com/api/v1", "LGL REST API base URL"],
    ["OrgName", "Pittsford Volunteer Ambulance — Loan Closet", "Display name used in emails/receipts"],
    ["TimeZone", "America/New_York", "Org timezone for automations"],
]

# ----------------------------------------------------------------------------
# DONORS (10)  — Pittsford / Monroe County area, all fictional
# ----------------------------------------------------------------------------
donors_header = ["DonorID", "FirstName", "LastName", "Email", "Phone", "Street", "City",
                 "State", "Zip", "LGLConstituentID", "LGLSyncStatus", "LGLLastSyncAt", "Notes"]
donors_rows = [
 ["DNR-001","Margaret","Kowalski","mkowalski62@example.com","(585) 555-0141","18 Stonecrest Dr","Pittsford","NY","14534","301245","Synced","2026-06-28 14:22","Repeat donor; prefers email receipts"],
 ["DNR-002","Raymond","Delgado","ray.delgado@example.com","(585) 555-0176","44 Mill Rd","Mendon","NY","14506","301252","Synced","2026-05-19 09:10",""],
 ["DNR-003","Priya","Natarajan","priya.n@example.com","(585) 555-0113","902 Ayrault Rd","Fairport","NY","14450","301260","Synced","2026-06-02 16:45","Donated after father's recovery"],
 ["DNR-004","Thomas","Brennan","tbrennan@example.com","(585) 555-0199","67 Sutherland St","Pittsford","NY","14534","","Not Synced","","Walk-in donor, no email receipt requested"],
 ["DNR-005","Eleanor","Fitch","efitch@example.com","(585) 555-0125","310 East Ave","Rochester","NY","14618","301277","Synced","2026-06-30 11:05","Estate donation (multiple items)"],
 ["DNR-006","Sam","Okafor","sokafor@example.com","(585) 555-0158","12 Ketchum Rd","Honeoye Falls","NY","14472","","Pending","","Queued for next sync run"],
 ["DNR-007","Linda","Tran","linda.tran@example.com","(585) 555-0132","5 Coventry Ct","Penfield","NY","14526","301289","Synced","2026-07-06 10:31",""],
 ["DNR-008","George","Aldrich","galdrich@example.com","(585) 555-0164","230 French Rd","Brighton","NY","14618","","Error","2026-07-06 10:32","Sync error: duplicate match review needed (see SYN-0113)"],
 ["DNR-009","Beatrice","Munoz","bmunoz@example.com","(585) 555-0187","81 Golf Ave","Pittsford","NY","14534","301301","Synced","2026-07-10 15:02","Also volunteers on Tuesdays"],
 ["DNR-010","Harold","Weiss","hweiss@example.com","(585) 555-0119","19 Rand Pl","Pittsford","NY","14534","","Not Synced","",f"New donor {md(-1)}; intake completed"],
]

# ----------------------------------------------------------------------------
# DONATIONS (14)
# ----------------------------------------------------------------------------
donations_header = ["DonationID", "DonorID", "DonationDate", "ItemCount", "EstimatedValue",
                    "ReceiptSent", "ReceiptSentAt", "LGLGiftID", "LGLSyncStatus", "IntakeStaff", "Notes"]
donations_rows = [
 ["DON-0001","DNR-001","2026-01-12",2,190,"Y","2026-01-12 15:40","88112","Synced","K. Ferraro","Wheelchair + cane, excellent shape"],
 ["DON-0002","DNR-002","2026-01-27",1,85,"Y","2026-01-27 12:05","88141","Synced","J. Osei","Rollator, near new"],
 ["DON-0003","DNR-003","2026-02-09",3,145,"Y","2026-02-09 16:22","88176","Synced","K. Ferraro","Walker, crutches, shower chair"],
 ["DON-0004","DNR-004","2026-02-21",1,60,"N","","","Not Synced","M. Quinn","Donor declined receipt; log for records only"],
 ["DON-0005","DNR-005","2026-03-05",5,720,"Y","2026-03-05 17:10","88214","Synced","K. Ferraro","Estate donation: 2 wheelchairs, transport chair, 2 walkers"],
 ["DON-0006","DNR-001","2026-03-18",1,40,"Y","2026-03-18 10:15","88232","Synced","J. Osei","Quad cane"],
 ["DON-0007","DNR-006","2026-04-02",2,230,"Y","2026-04-02 14:48","","Pending","M. Quinn","Knee scooter + toilet frame; gift sync queued"],
 ["DON-0008","DNR-007","2026-04-20",1,95,"Y","2026-04-20 11:30","88301","Synced","K. Ferraro","Transport chair"],
 ["DON-0009","DNR-008","2026-05-08",2,150,"Y","2026-05-08 13:55","","Error","J. Osei","Blocked on constituent match (DNR-008)"],
 ["DON-0010","DNR-009","2026-05-26",1,120,"Y","2026-05-26 09:20","88356","Synced","M. Quinn","Rollator w/ seat"],
 ["DON-0011","DNR-003","2026-06-10",1,35,"Y","2026-06-10 15:05","88389","Synced","K. Ferraro","Pair of crutches"],
 ["DON-0012","DNR-005","2026-06-24",2,180,"Y","2026-06-24 16:40","88412","Synced","J. Osei","Commode + transfer bench"],
 ["DON-0013","DNR-007","2026-07-06",1,75,"Y","2026-07-06 10:25","88437","Synced","M. Quinn","Shower chair, like new"],
 ["DON-0014","DNR-010","2026-07-12",2,160,"N","","","Not Synced","K. Ferraro","Walker + raised toilet seat; receipt queued"],
]

# ----------------------------------------------------------------------------
# EQUIPMENT (36)
# ----------------------------------------------------------------------------
equip_header = ["EquipmentID", "AssetTag", "Category", "Make", "Model", "SerialNumber", "Size",
                "Condition", "Status", "StorageLocation", "AcquisitionType", "DonationID",
                "AcquiredDate", "EstimatedValue", "Notes"]
E = []
def eq(i, cat, make, model, serial, size, cond, status, loc, acq, don, date, val, notes=""):
    E.append([f"EQ-{i:04d}", f"PVA-LC-{i:04d}", cat, make, model, serial, size, cond, status,
              loc, acq, don, date, val, notes])

# Wheelchairs (6)
eq(1,"Wheelchair","Drive Medical","Blue Streak","BS18-77241","18 in seat","Good","Available","Aisle A / Shelf 1","Donated","DON-0001","2026-01-12",95)
eq(2,"Wheelchair","Invacare","Tracer EX2","TEX2-50318","20 in seat","Good","On Loan","Aisle A / Shelf 1","Donated","DON-0005","2026-03-05",180)
eq(3,"Wheelchair","Medline","Excel K1","K1-88402","18 in seat","Excellent","Available","Aisle A / Shelf 2","Donated","DON-0005","2026-03-05",165)
eq(4,"Wheelchair","Drive Medical","Cruiser III","CR3-11957","16 in seat (narrow)","Fair","In Repair","Repair Bench","Purchased","","2024-09-15",90,"Left brake sticking — TKT-0002")
eq(5,"Wheelchair","Medline","K3 Basic","K3-90211","18 in seat","Good","Available","Aisle A / Shelf 2","Purchased","","2025-02-10",140)
eq(6,"Wheelchair","Karman","LT-980","LT980-4471","18 in seat (ultralight)","Excellent","On Loan","Aisle A / Shelf 1","Purchased","","2025-06-20",210)
# Transport chairs (2)
eq(7,"Transport Chair","Medline","Freedom 2","FR2-33810","19 in seat","Good","Available","Aisle A / Shelf 3","Donated","DON-0008","2026-04-20",95)
eq(8,"Transport Chair","Drive Medical","Fly Lite","FL-72019","19 in seat","Good","Available","Aisle A / Shelf 3","Donated","DON-0005","2026-03-05",110)
# Rollators (5)
eq(9,"Rollator","Drive Medical","Nitro Euro Style","NIT-60112","Standard","Excellent","On Loan","Aisle B / Shelf 1","Donated","DON-0002","2026-01-27",85)
eq(10,"Rollator","NOVA","GetGO Classic","GG-48273","Standard","Good","Available","Aisle B / Shelf 1","Purchased","","2024-08-19",75)
eq(11,"Rollator","Medline","Empower","EMP-15540","Bariatric","Good","Available","Aisle B / Shelf 2","Donated","DON-0010","2026-05-26",120)
eq(12,"Rollator","Hugo Mobility","Elite","HE-90731","Standard","Fair","In Cleaning","Cleaning Station","Purchased","","2023-12-04",60,f"Returned {md(-2)}; sanitize + wheel check")
eq(13,"Rollator","Drive Medical","Duet","DU-20984","Standard","Good","Available","Aisle B / Shelf 2","Donated","DON-0009","2026-05-08",95)
# Walkers (6)
eq(14,"Walker","Medline","Two-Button Folding","TBF-77103","Adult","Good","Available","Aisle B / Shelf 3","Donated","DON-0003","2026-02-09",30)
eq(15,"Walker","Drive Medical","Deluxe Trigger","DT-41522","Adult","Excellent","On Loan","Aisle B / Shelf 3","Purchased","","2025-03-30",45)
eq(16,"Walker","Guardian","Easy Care","EC-63348","Junior","Good","Available","Aisle B / Shelf 4","Donated","DON-0005","2026-03-05",35)
eq(17,"Walker","Medline","Two-Button w/ Wheels","TBW-88910","Adult","Good","Available","Aisle B / Shelf 3","Donated","DON-0014","2026-07-12",40,f"New intake {md(-1)} — tag printed")
eq(18,"Walker","Carex","Folding","CF-30217","Adult","Fair","Available","Aisle B / Shelf 4","Donated","DON-0009","2026-05-08",25)
eq(19,"Walker","Drive Medical","Side Style Hemi","SSH-51125","Hemi (one-hand)","Good","Available","Aisle B / Shelf 4","Donated","DON-0005","2026-03-05",38)
# Knee scooters (2)
eq(20,"Knee Scooter","KneeRover","Steerable","KR-77415","Standard","Good","In Repair","Repair Bench","Donated","DON-0007","2026-04-02",130,"Brake cable frayed — TKT-0005")
eq(21,"Knee Scooter","Drive Medical","DV8","DV8-62230","Standard","Excellent","On Loan","Aisle C / Shelf 1","Purchased","","2025-08-14",145)
# Crutches (4)
eq(22,"Crutches","Medline","Aluminum (pair)","AL-90112","Adult 5'2\"-5'10\"","Good","Available","Aisle C / Bin 1","Donated","DON-0003","2026-02-09",22)
eq(23,"Crutches","Guardian","Aluminum (pair)","AL-90881","Adult 5'10\"-6'6\"","Good","Available","Aisle C / Bin 1","Donated","DON-0011","2026-06-10",22)
eq(24,"Crutches","Carex","Push-Button (pair)","PB-44107","Youth","Excellent","Available","Aisle C / Bin 2","Purchased","","2025-05-09",28)
eq(25,"Crutches","Medline","Forearm (pair)","FA-18220","Adult","Good","On Loan","Aisle C / Bin 2","Purchased","","2024-10-25",35)
# Canes (4)
eq(26,"Cane","Hugo Mobility","Adjustable Derby","AD-70331","Standard","Excellent","Available","Aisle C / Bin 3","Donated","DON-0001","2026-01-12",18)
eq(27,"Cane","Drive Medical","Folding w/ Seat","FS-25518","Standard","Good","Available","Aisle C / Bin 3","Donated","DON-0004","2026-02-21",30)
eq(28,"Quad Cane","Medline","Small Base","QSB-61240","Standard","Good","Available","Aisle C / Bin 3","Donated","DON-0006","2026-03-18",24)
eq(29,"Quad Cane","NOVA","Large Base","QLB-83726","Standard","Fair","Retired","Storage — Retired Bin","Purchased","","2022-06-30",0,"Worn tips + shaft wobble; retired 6/2026")
# Bath safety (7)
eq(30,"Shower Chair","Medline","w/ Back","SCB-51902","300 lb cap","Good","Available","Aisle D / Shelf 1","Donated","DON-0003","2026-02-09",35)
eq(31,"Shower Chair","Carex","Adjustable","SCA-66319","250 lb cap","Excellent","Available","Aisle D / Shelf 1","Donated","DON-0013","2026-07-06",42)
eq(32,"Shower Chair","Drive Medical","Bariatric","SCX-70228","500 lb cap","Fair","Quarantined","Quarantine Shelf","Purchased","","2023-07-21",55,"Hairline seat crack reported — TKT-0004; do not loan")
eq(33,"Tub Transfer Bench","Medline","Sliding","TTB-40921","Standard","Good","Available","Aisle D / Shelf 2","Donated","DON-0012","2026-06-24",70)
eq(34,"Bedside Commode","Drive Medical","Folding Steel","BC-33450","350 lb cap","Good","Available","Aisle D / Shelf 3","Donated","DON-0012","2026-06-24",48)
eq(35,"Raised Toilet Seat","Carex","w/ Handles","RTS-28831","5 in riser","Good","Available","Aisle D / Shelf 4","Donated","DON-0014","2026-07-12",32)
eq(36,"Toilet Safety Frame","Medline","Adjustable","TSF-91507","Standard","Excellent","On Loan","Aisle D / Shelf 4","Donated","DON-0007","2026-04-02",30)
equipment_rows = E

# ----------------------------------------------------------------------------
# BORROWERS (14)
# ----------------------------------------------------------------------------
borrowers_header = ["BorrowerID", "FirstName", "LastName", "Phone", "Email", "Street", "City",
                    "State", "Zip", "WaiverOnFile", "WaiverDate", "LGLConstituentID",
                    "LGLSyncStatus", "Notes"]
borrowers_rows = [
 ["BRW-0001","Alice","Hartman","(585) 555-0201","ahartman@example.com","12 Rand Pl","Pittsford","NY","14534","Y","2026-01-15","301310","Synced","Post-surgery knee recovery"],
 ["BRW-0002","Devon","Marsh","(585) 555-0214","dmarsh@example.com","230 Thornell Rd","Pittsford","NY","14534","Y","2026-01-22","301311","Synced",""],
 ["BRW-0003","Carmen","Reyes","(585) 555-0227","creyes@example.com","55 Knickerbocker Rd","Pittsford","NY","14534","Y","2026-02-03","301315","Synced",""],
 ["BRW-0004","Frank","Osterhout","(585) 555-0233","fosterhout@example.com","801 Moseley Rd","Fairport","NY","14450","Y","2026-02-14","","Not Synced","Daughter is primary contact"],
 ["BRW-0005","Grace","Liu","(585) 555-0246","gliu@example.com","14 Tobey Rd","Pittsford","NY","14534","Y","2026-02-27","301322","Synced",""],
 ["BRW-0006","Hank","Petrocelli","(585) 555-0252","hpetrocelli@example.com","96 Monroe Ave","Pittsford","NY","14534","Y","2026-03-09","","Not Synced",""],
 ["BRW-0007","Imani","Wallace","(585) 555-0269","iwallace@example.com","310 Clover St","Brighton","NY","14618","Y","2026-03-21","301330","Synced",""],
 ["BRW-0008","Jack","Sorenson","(585) 555-0275","jsorenson@example.com","72 W Bloomfield Rd","Honeoye Falls","NY","14472","Y","2026-04-06","","Not Synced","Hip replacement recovery"],
 ["BRW-0009","Karen","Abramowitz","(585) 555-0288","kabramowitz@example.com","41 Sunset Blvd","Pittsford","NY","14534","Y","2026-04-18","301341","Synced",""],
 ["BRW-0010","Luis","Fonseca","(585) 555-0294","lfonseca@example.com","188 Marsh Rd","Pittsford","NY","14534","Y","2026-05-02","","Not Synced",""],
 ["BRW-0011","Maeve","O'Rourke","(585) 555-0307","morourke@example.com","23 Church St","Pittsford","NY","14534","Y","2026-05-16","301352","Synced","Broken ankle — knee scooter"],
 ["BRW-0012","Nathan","Choi","(585) 555-0313","nchoi@example.com","405 Jefferson Rd","Pittsford","NY","14534","Y","2026-06-01","","Not Synced",""],
 ["BRW-0013","Opal","Jennings","(585) 555-0326","ojennings@example.com","9 Locust Hill Dr","Pittsford","NY","14534","Y","2026-06-15","","Not Synced","Referred by discharge planner"],
 ["BRW-0014","Peter","Vanderkamp","(585) 555-0339","pvanderkamp@example.com","150 Mendon Center Rd","Pittsford","NY","14534","Y","2026-07-02","","Not Synced",""],
]

# ----------------------------------------------------------------------------
# LOANS (19)  — dates authored against ANCHOR 2026-07-13, shifted to DEMO_DATE
#   Returned: 12 · Overdue: 3 · Active: 4
#   LN-00018 = the due-soon fixture (due ANCHOR+7, no reminder yet → fires live)
#   LN-00013 = overdue fixture back-dated so an escalating notice fires live
# ----------------------------------------------------------------------------
loans_header = ["LoanID", "EquipmentID", "BorrowerID", "CheckoutDate", "DueDate", "ReturnedDate",
                "Status", "ConditionOut", "ConditionIn", "CheckedOutBy", "CheckedInBy",
                "LastReminderSentAt", "OverdueNoticeCount", "Notes"]
loans_rows = [
 ["LN-00001","EQ-0001","BRW-0001","2026-01-16","2026-04-16","2026-03-28","Returned","Good","Good","K. Ferraro","J. Osei","","0",""],
 ["LN-00002","EQ-0014","BRW-0002","2026-01-23","2026-04-23","2026-04-10","Returned","Good","Good","J. Osei","J. Osei","2026-04-16","0",""],
 ["LN-00003","EQ-0022","BRW-0003","2026-02-05","2026-05-06","2026-04-02","Returned","Good","Good","K. Ferraro","M. Quinn","","0",""],
 ["LN-00004","EQ-0010","BRW-0004","2026-02-16","2026-05-17","2026-05-30","Returned","Good","Fair","M. Quinn","K. Ferraro","2026-05-10","2","Returned late; brake pads worn"],
 ["LN-00005","EQ-0027","BRW-0005","2026-03-02","2026-05-31","2026-05-20","Returned","Good","Good","J. Osei","J. Osei","2026-05-24","0",""],
 ["LN-00006","EQ-0008","BRW-0006","2026-03-12","2026-06-10","2026-06-05","Returned","Good","Good","K. Ferraro","M. Quinn","2026-06-03","0",""],
 ["LN-00007","EQ-0030","BRW-0007","2026-03-24","2026-06-22","2026-06-18","Returned","Good","Good","M. Quinn","K. Ferraro","2026-06-15","0",""],
 ["LN-00008","EQ-0005","BRW-0008","2026-04-08","2026-07-07","2026-07-01","Returned","Good","Good","J. Osei","J. Osei","2026-06-30","0",""],
 ["LN-00009","EQ-0016","BRW-0009","2026-04-20","2026-07-19","2026-06-27","Returned","Good","Good","K. Ferraro","M. Quinn","","0",""],
 ["LN-00010","EQ-0024","BRW-0010","2026-05-04","2026-08-02","2026-06-20","Returned","Excellent","Good","M. Quinn","J. Osei","","0",""],
 ["LN-00011","EQ-0012","BRW-0013","2026-06-16","2026-09-14","2026-07-11","Returned","Fair","Fair","J. Osei","K. Ferraro","","0","Early return; sent to cleaning (EQ-0012)"],
 ["LN-00012","EQ-0003","BRW-0012","2026-06-02","2026-06-30","2026-06-29","Returned","Excellent","Excellent","K. Ferraro","J. Osei","2026-06-23","0","Short-term loan (28 days) by request"],
 # --- Overdue (3) ---
 ["LN-00013","EQ-0002","BRW-0004","2026-03-30","2026-06-28","","Overdue","Good","","M. Quinn","","2026-07-05","2","No response to 2 notices; escalated TKT-0007"],
 ["LN-00014","EQ-0009","BRW-0006","2026-04-04","2026-07-03","","Overdue","Excellent","","K. Ferraro","","2026-07-10","1","Borrower requested extension call-back"],
 ["LN-00015","EQ-0025","BRW-0002","2026-04-11","2026-07-10","","Overdue","Good","","J. Osei","","2026-07-11","1",""],
 # --- Active (4) ---
 ["LN-00016","EQ-0021","BRW-0011","2026-05-18","2026-08-16","","Active","Excellent","","K. Ferraro","","","0","Knee scooter for ankle fracture"],
 ["LN-00017","EQ-0015","BRW-0014","2026-07-03","2026-10-01","","Active","Excellent","","M. Quinn","","","0",""],
 ["LN-00018","EQ-0036","BRW-0009","2026-04-21","2026-07-20","","Active","Excellent","","J. Osei","","","0","Due-soon demo fixture: reminder fires on the next daily scan (7-day window)"],
 ["LN-00019","EQ-0006","BRW-0007","2026-06-20","2026-09-18","","Active","Excellent","","K. Ferraro","","","0","Ultralight chair for travel period"],
]

# ----------------------------------------------------------------------------
# SUPPORT TICKETS (9)
# ----------------------------------------------------------------------------
tickets_header = ["TicketID", "EquipmentID", "LoanID", "ReportedBy", "ReporterType", "IssueType",
                  "Priority", "Status", "OpenedAt", "AssignedTo", "ResolvedAt", "ResolutionNotes"]
tickets_rows = [
 ["TKT-0001","EQ-0018","","M. Quinn","Staff","Missing Part","Low","Resolved","2026-05-14 09:12","M. Quinn","2026-05-16 13:30","Replaced missing rubber tips from spares bin"],
 ["TKT-0002","EQ-0004","","K. Ferraro","Staff","Repair Needed","Medium","In Progress","2026-06-25 10:41","R. Boyd (volunteer)","","Left wheel brake sticking; caliper ordered"],
 ["TKT-0003","EQ-0012","LN-00011","Opal Jennings","Borrower","Cleaning Required","Low","Resolved","2026-07-11 14:05","J. Osei","2026-07-12 11:00","Full sanitize done; wheel check pending recheck"],
 ["TKT-0004","EQ-0032","","J. Osei","Staff","Damage Reported","High","In Progress","2026-07-02 08:55","K. Ferraro","","Hairline crack in seat; quarantined pending replacement decision"],
 ["TKT-0005","EQ-0020","","R. Boyd","Volunteer","Repair Needed","Medium","Waiting on Parts","2026-06-29 15:20","R. Boyd (volunteer)","",f"Brake cable frayed; part ETA {md(5)}"],
 ["TKT-0006","","","Harold Weiss","Donor","Donation Question","Low","New","2026-07-12 16:44","","","Asks whether receipt covers both items (DON-0014)"],
 ["TKT-0007","EQ-0002","LN-00013","K. Ferraro","Staff","Overdue Follow-up","High","In Progress","2026-07-12 09:30","M. Quinn","","Two notices sent, no response; attempt phone contact"],
 ["TKT-0008","","","M. Quinn","Staff","App/Data Issue","Low","Closed","2026-06-18 11:25","K. Ferraro","2026-06-18 15:10","Photo upload failed on intake form; retrained on WiFi handoff"],
 ["TKT-0009","EQ-0031","","Linda Tran","Donor","Other","Low","New","2026-07-13 08:20","","","Donor asks for confirmation item is in circulation"],
]

# ----------------------------------------------------------------------------
# LGL SYNC LOG (15)
# ----------------------------------------------------------------------------
synclog_header = ["SyncID", "Timestamp", "Direction", "ObjectType", "LocalID", "LGLID",
                  "Action", "Status", "HTTPStatus", "Message"]
synclog_rows = [
 ["SYN-0101","2026-06-28 14:22","Push","Donor","DNR-001","301245","Match Constituent (email)","Success","200","Matched existing constituent; no create needed"],
 ["SYN-0102","2026-06-28 14:22","Push","Donation","DON-0001","88112","Create Gift (in-kind $190)","Success","201","Gift created under constituent 301245"],
 ["SYN-0103","2026-06-30 11:05","Push","Donor","DNR-005","301277","Create Constituent","Success","201","New constituent created"],
 ["SYN-0104","2026-06-30 11:06","Push","Donation","DON-0005","88214","Create Gift (in-kind $720)","Success","201","Estate donation logged"],
 ["SYN-0105","2026-07-06 10:31","Push","Donor","DNR-007","301289","Match Constituent (email)","Success","200",""],
 ["SYN-0106","2026-07-06 10:31","Push","Donation","DON-0013","88437","Create Gift (in-kind $75)","Success","201",""],
 ["SYN-0107","2026-07-06 10:32","Push","Donor","DNR-008","","Match Constituent (email)","Error","300","Multiple constituent matches (2); manual review required"],
 ["SYN-0108","2026-07-06 10:32","Push","Donation","DON-0009","","Create Gift (in-kind $150)","Skipped","","Blocked: donor constituent unresolved"],
 ["SYN-0109","2026-07-10 15:02","Push","Donor","DNR-009","301301","Create Constituent","Success","201",""],
 ["SYN-0110","2026-07-10 15:03","Push","Borrower","BRW-0011","301352","Create Constituent (service contact)","Success","201","Borrowers tracked as constituents w/ 'Loan Closet' group"],
 ["SYN-0111","2026-07-11 09:00","Pull","Donor","DNR-003","301260","Refresh Constituent","Success","200","Address unchanged"],
 ["SYN-0112","2026-07-12 09:00","Push","Donation","DON-0007","","Create Gift (in-kind $230)","Pending","","Queued: nightly batch"],
 ["SYN-0113","2026-07-12 09:01","Push","Donor","DNR-008","","Retry Match Constituent","Error","300","Still ambiguous; see ticket queue"],
 ["SYN-0114","2026-07-13 09:00","Push","Donor","DNR-006","","Create Constituent","Pending","","Queued: nightly batch"],
 ["SYN-0115","2026-07-13 09:00","Push","Donation","DON-0014","","Create Gift (in-kind $160)","Pending","","Queued: awaiting receipt send"],
]

# ----------------------------------------------------------------------------
# Apply the demo-date shift to every dated table (relative-date staging)
# ----------------------------------------------------------------------------
for _rows in (donors_rows, donations_rows, equipment_rows, borrowers_rows,
              loans_rows, tickets_rows, synclog_rows):
    shift_rows(_rows)

# ----------------------------------------------------------------------------
# Integrity checks
# ----------------------------------------------------------------------------
eq_ids = {r[0] for r in equipment_rows}
donor_ids = {r[0] for r in donors_rows}
don_ids = {r[0] for r in donations_rows}
brw_ids = {r[0] for r in borrowers_rows}
loan_ids = {r[0] for r in loans_rows}

for r in donations_rows:
    assert r[1] in donor_ids, f"Donation {r[0]} bad donor {r[1]}"
for r in equipment_rows:
    if r[11]:
        assert r[11] in don_ids, f"Equipment {r[0]} bad donation {r[11]}"
for r in loans_rows:
    assert r[1] in eq_ids and r[2] in brw_ids, f"Loan {r[0]} bad refs"
for r in tickets_rows:
    if r[1]: assert r[1] in eq_ids, f"Ticket {r[0]} bad equipment"
    if r[2]: assert r[2] in loan_ids, f"Ticket {r[0]} bad loan"

# On-loan equipment must have exactly one open loan and vice versa
on_loan_eq = {r[0] for r in equipment_rows if r[8] == "On Loan"}
open_loan_eq = {r[1] for r in loans_rows if r[6] in ("Active", "Overdue")}
assert on_loan_eq == open_loan_eq, f"Mismatch: {on_loan_eq ^ open_loan_eq}"
# Donation ItemCount matches linked equipment counts
from collections import Counter
link_counts = Counter(r[11] for r in equipment_rows if r[11])
for r in donations_rows:
    expected = r[3]
    actual = link_counts.get(r[0], 0)
    assert actual == expected, f"{r[0]} ItemCount={expected} but linked equipment={actual}"

print("Integrity checks passed.")

# ----------------------------------------------------------------------------
# Demo-staging assertions — lock the scripted scenario to DEMO_DATE so a future
# regeneration (or any date edit) can never silently break the live demo.
# ----------------------------------------------------------------------------
def _d(s):  # date part of an ISO date/datetime string
    return date.fromisoformat(s[:10])

_cfg = {r[0]: r[1] for r in config_rows}
_warn = int(_cfg["ReminderDaysBeforeDue"])
_every = int(_cfg["OverdueReminderEveryDays"])

_by_status = {}
for r in loans_rows:
    _by_status.setdefault(r[6], []).append(r)  # Status = index 6

_overdue = _by_status.get("Overdue", [])
assert len(_overdue) == 3, f"expected 3 overdue loans, got {len(_overdue)}"
for r in _overdue:
    assert _d(r[4]) < DEMO_DATE, f"{r[0]} is Overdue but DueDate {r[4]} not before demo {DEMO_DATE}"

_active = _by_status.get("Active", [])
_due_soon = [r for r in _active if DEMO_DATE <= _d(r[4]) <= DEMO_DATE + timedelta(days=_warn)]
assert len(_due_soon) == 1 and _due_soon[0][0] == "LN-00018", \
    f"expected exactly LN-00018 in the due-soon window, got {[r[0] for r in _due_soon]}"
assert not _due_soon[0][11], "LN-00018 LastReminderSentAt must be blank so the live scan fires it"

def _days_since(ts):  # days from a LastReminderSentAt stamp to the demo date
    return (DEMO_DATE - _d(ts)).days if ts else 10 ** 6
_fires = sum(1 for r in _overdue if _days_since(r[11]) >= _every)
assert _fires >= 1, "no overdue loan is past its reminder cadence on the demo date (no live overdue notice would fire)"

# supporting fixtures the walkthrough relies on
assert any(r[10] == "Error" for r in donors_rows), "DNR-008 ambiguous-match error fixture missing"
assert any(r[7] == "Pending" for r in synclog_rows), "no pending LGL sync fixture"
assert {r[7] for r in tickets_rows} >= set(TKT_STATUS), \
    f"tickets missing statuses: {set(TKT_STATUS) - {r[7] for r in tickets_rows}}"

print(f"Demo staging OK for {DEMO_DATE} (shift {SHIFT:+d}d from anchor {ANCHOR}): "
      f"{len(_overdue)} overdue, 1 due-soon (LN-00018), {_fires} overdue notice(s) fire live.")

# ----------------------------------------------------------------------------
# README tab content
# ----------------------------------------------------------------------------
readme_rows = [
    ["PVA Loan Closet — AppSheet Backend (PROTOTYPE / MOCK DATA)"],
    [""],
    ["Purpose", "Backend for the Mobility Equipment Loan Closet AppSheet prototype. Import this workbook to Google Sheets, then connect AppSheet to each tab listed below."],
    ["Data notice", "All names, contacts, addresses, IDs, and LGL identifiers are fictional test data created for this exercise. No real organizational or personal data is used."],
    ["Demo staging", f"Dates are relative: generated for {DEMO_DATE.isoformat()} so due-soon, overdue, and pending-sync states are live on demo day. Re-run data/generate_data.py to re-stage for any date."],
    [""],
    ["Tab", "Role", "Key (AppSheet)", "References"],
    ["Equipment", "Every physical item, one row each; AssetTag = QR/barcode label value", "EquipmentID", "DonationID → Donations"],
    ["Donors", "People/households who donate equipment", "DonorID", "— (synced to LGL constituents)"],
    ["Donations", "One intake event per drop-off; receipt + LGL gift tracking", "DonationID", "DonorID → Donors"],
    ["Borrowers", "People who borrow equipment; waiver tracking", "BorrowerID", "— (optionally synced to LGL)"],
    ["Loans", "Checkout/return cycle; one row per loan", "LoanID", "EquipmentID → Equipment, BorrowerID → Borrowers"],
    ["SupportTickets", "Repairs, cleaning, damage, follow-ups", "TicketID", "EquipmentID → Equipment, LoanID → Loans"],
    ["LGL_SyncLog", "Append-only audit trail written by Apps Script sync engine", "SyncID", "LocalID → any table"],
    ["Lookups", "Enum values driving AppSheet dropdowns", "(LookupType+Value)", "—"],
    ["Config", "Org settings read by Apps Script + AppSheet bots", "Key", "—"],
    [""],
    ["Editing", "Green-tabbed sheets are live data tables edited through the app. Grey tabs (Lookups, Config, _ReadMe) are admin-only."],
    ["Status logic", "Equipment.Status 'On Loan' must always pair with exactly one Loans row in Active/Overdue status — enforced by AppSheet actions in the app layer."],
]

# ----------------------------------------------------------------------------
# Write CSVs
# ----------------------------------------------------------------------------
tables = {
    "Equipment": (equip_header, equipment_rows),
    "Donors": (donors_header, donors_rows),
    "Donations": (donations_header, donations_rows),
    "Borrowers": (borrowers_header, borrowers_rows),
    "Loans": (loans_header, loans_rows),
    "SupportTickets": (tickets_header, tickets_rows),
    "LGL_SyncLog": (synclog_header, synclog_rows),
    "Lookups": (lookups_header, lookups_rows),
    "Config": (config_header, config_rows),
}
for name, (hdr, rows) in tables.items():
    with open(os.path.join(CSV_DIR, f"{name}.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(hdr)
        w.writerows(rows)
print(f"Wrote {len(tables)} CSVs")

# ----------------------------------------------------------------------------
# Build XLSX
# ----------------------------------------------------------------------------
NAVY = "1F3864"; RED = "9E1B1B"; LIGHT = "F2F2F2"
HDR_FONT = Font(name="Arial", size=10, bold=True, color="FFFFFF")
BODY_FONT = Font(name="Arial", size=10)
TITLE_FONT = Font(name="Arial", size=14, bold=True, color=NAVY)
thin = Side(style="thin", color="D9D9D9")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()
ws = wb.active
ws.title = "_ReadMe"
ws.sheet_properties.tabColor = "808080"
for i, row in enumerate(readme_rows, 1):
    for j, val in enumerate(row, 1):
        c = ws.cell(row=i, column=j, value=val)
        c.font = BODY_FONT
        c.alignment = Alignment(vertical="top", wrap_text=True)
ws["A1"].font = TITLE_FONT
for j in range(1, 5):
    c = ws.cell(row=7, column=j)
    c.font = HDR_FONT
    c.fill = PatternFill("solid", fgColor=NAVY)
for col, width in zip("ABCD", (22, 68, 20, 40)):
    ws.column_dimensions[col].width = width
ws.cell(row=4, column=1).font = Font(name="Arial", size=10, bold=True, color=RED)
ws.cell(row=4, column=2).font = Font(name="Arial", size=10, color=RED)

def add_table_sheet(wb, name, header, rows, tab_color=None):
    ws = wb.create_sheet(name)
    if tab_color:
        ws.sheet_properties.tabColor = tab_color
    for j, h in enumerate(header, 1):
        c = ws.cell(row=1, column=j, value=h)
        c.font = HDR_FONT
        c.fill = PatternFill("solid", fgColor=NAVY)
        c.alignment = Alignment(vertical="center")
        c.border = BORDER
    for i, row in enumerate(rows, 2):
        for j, val in enumerate(row, 1):
            c = ws.cell(row=i, column=j, value=val)
            c.font = BODY_FONT
            c.border = BORDER
            if i % 2 == 0:
                c.fill = PatternFill("solid", fgColor=LIGHT)
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = f"A1:{get_column_letter(len(header))}{len(rows)+1}"
    for j, h in enumerate(header, 1):
        maxlen = max([len(str(h))] + [len(str(r[j-1])) for r in rows])
        ws.column_dimensions[get_column_letter(j)].width = min(max(maxlen + 2, 10), 46)
    return ws

GREEN = "2E7D32"
for name in ["Equipment", "Donors", "Donations", "Borrowers", "Loans", "SupportTickets"]:
    add_table_sheet(wb, name, *tables[name], tab_color=GREEN)
add_table_sheet(wb, "LGL_SyncLog", *tables["LGL_SyncLog"], tab_color="C55A11")
add_table_sheet(wb, "Lookups", *tables["Lookups"], tab_color="808080")
add_table_sheet(wb, "Config", *tables["Config"], tab_color="808080")

xlsx_path = os.path.join(OUT, "loan_closet_backend.xlsx")
wb.save(xlsx_path)
print(f"Saved {xlsx_path}")
