/**
 * TheJugaadSRE lab: lead capture + login + game scores + screenshot proofs (Google Apps Script).
 * Bind to a PRIVATE Google Sheet (Extensions > Apps Script), then
 * Deploy > New deployment > Web app > Execute as: Me | Who has access: Anyone.
 * After ANY change to this file: Deploy > Manage deployments > Edit > New version > Deploy.
 * (The first deploy asks you to authorise Google Drive access: screenshots are saved to a
 *  private Drive folder called "IAM Lab Proofs" in YOUR Drive.)
 *
 * Rows are keyed by email, so one student = one row (no duplicates).
 *   signup    -> new row, or "exists" if the email is already there
 *   progress  -> updates progress / points / tasks / quiz (creates the row if it is missing)
 *   completed -> same as progress, status becomes "completed"
 *   proof     -> saves a screenshot to Drive and records the task id on the row
 *   login     -> email + WhatsApp must match a row; returns profile + saved progress
 */
const HEADERS = ["First seen", "Status", "Name", "Email", "WhatsApp", "College", "Year", "LinkedIn", "Consent", "Progress %", "Source", "Last active", "Tasks done", "Points", "Screenshots", "Proof tasks", "Quiz"];
const COL = { STATUS: 2, PROGRESS: 10, ACTIVE: 12, TASKS: 13, POINTS: 14, SHOTS: 15, PROOFS: 16, QUIZ: 17 };
const FOLDER_NAME = "IAM Lab Proofs";

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function digits_(s) { return String(s || "").replace(/\D/g, "").slice(-10); }
// stop spreadsheet formula injection (=, +, -, @ at the start of a value)
function clean_(s) {
  s = String(s || "").slice(0, 300);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function findRow_(sheet, email) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2, 4, last - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim().toLowerCase() === email) return i + 2;
  }
  return 0;
}
function folder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
// save one screenshot, replacing any earlier one for the same student + task
function saveProof_(email, task, dataUrl) {
  const m = String(dataUrl || "").match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+\/=]+)$/);
  if (!m || dataUrl.length > 700000 || !/^t\d{1,2}[a-z]$/.test(task)) return false;
  const name = email.replace(/[^a-z0-9@._-]/gi, "_") + "__" + task + (m[1] === "image/png" ? ".png" : ".jpg");
  const folder = folder_();
  const old = folder.getFilesByName(name);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
  return true;
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    const head = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
    if (head.join("|") !== HEADERS.join("|")) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    const p = e.parameter || {};
    const email = String(p.email || "").trim().toLowerCase();
    if (!email) return json_({ ok: false });
    const now = new Date();
    const row = findRow_(sheet, email);
    const type = p.type || "progress";

    if (type === "login") {
      if (!row || !digits_(p.whatsapp)) return json_({ ok: false });
      const r = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      if (digits_(r[4]) !== digits_(p.whatsapp)) return json_({ ok: false });
      sheet.getRange(row, COL.ACTIVE).setValue(now);
      return json_({ ok: true, name: r[2], email: r[3], whatsapp: String(r[4]), college: r[5], year: r[6], linkedin: r[7], progress: r[9], tasks: String(r[12] || ""), proofs: String(r[15] || ""), quiz: String(r[16] || "") });
    }

    if (type === "proof") {
      if (!row) return json_({ ok: false });
      if (!saveProof_(email, String(p.task || ""), p.image)) return json_({ ok: false });
      const cell = sheet.getRange(row, COL.PROOFS);
      const list = String(cell.getValue() || "").split(",").filter(Boolean);
      if (list.indexOf(p.task) < 0) list.push(p.task);
      cell.setValue(list.join(","));
      sheet.getRange(row, COL.SHOTS).setValue(list.length);
      sheet.getRange(row, COL.ACTIVE).setValue(now);
      return json_({ ok: true, status: "proof" });
    }

    const progress = Number(p.progress) || 0;
    const status = progress >= 100 ? "completed" : "registered";

    if (!row) {
      sheet.appendRow([now, status, clean_(p.name), email, clean_(p.whatsapp), clean_(p.college), clean_(p.year), clean_(p.linkedin), p.consent || "", progress, clean_(p.source), now, clean_(p.tasks), Number(p.points) || 0, 0, clean_(p.proofs), clean_(p.quiz)]);
      return json_({ ok: true, status: "new" });
    }

    sheet.getRange(row, COL.ACTIVE).setValue(now);
    if (type === "signup") return json_({ ok: true, status: "exists" });

    sheet.getRange(row, COL.PROGRESS).setValue(progress);
    sheet.getRange(row, COL.STATUS).setValue(status);
    if (p.tasks !== undefined) sheet.getRange(row, COL.TASKS).setValue(clean_(p.tasks));
    if (p.points !== undefined) sheet.getRange(row, COL.POINTS).setValue(Number(p.points) || 0);
    if (p.quiz !== undefined) sheet.getRange(row, COL.QUIZ).setValue(clean_(p.quiz));
    return json_({ ok: true, status: "updated" });
  } finally {
    lock.releaseLock();
  }
}

/* ---- Optional: "TheJugaad Tools" menu in the Sheet ---- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu("TheJugaad Tools").addItem("Clear all leads", "clearLeads").addToUi();
}
function clearLeads() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const rows = sheet.getLastRow() - 1;
  if (rows < 1) return ui.alert("Nothing to clear.");
  const ok = ui.alert("Delete all " + rows + " lead rows?", "This cannot be undone from the menu.", ui.ButtonSet.YES_NO);
  if (ok === ui.Button.YES) sheet.deleteRows(2, rows);
}
