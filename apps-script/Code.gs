/**
 * TheJugaadSRE lab: lead capture + login + game scores (Google Apps Script).
 * Bind to a PRIVATE Google Sheet (Extensions > Apps Script), then
 * Deploy > New deployment > Web app > Execute as: Me | Who has access: Anyone.
 * After ANY change to this file: Deploy > Manage deployments > Edit > New version > Deploy.
 *
 * Rows are keyed by email, so one student = one row (no duplicates).
 *   signup    -> new row, or "exists" if the email is already there
 *   progress  -> updates progress / points / tasks / quiz (creates the row if it is missing)
 *   completed -> same as progress, status becomes "completed"
 *   login     -> email + WhatsApp must match a row; returns profile + saved progress
 *   feedback  -> one row per student in a "Feedback" tab (created automatically)
 */
const HEADERS = ["First seen", "Status", "Name", "Email", "WhatsApp", "College", "Year", "LinkedIn", "Consent", "Progress %", "Source", "Last active", "Tasks done", "Points", "Quiz"];
const FEEDBACK_TAB = "Feedback";
const FEEDBACK_HEADERS = ["Timestamp", "Name", "Email", "College", "Mood (1-5)", "Comment"];
const COL = { STATUS: 2, PROGRESS: 10, ACTIVE: 12, TASKS: 13, POINTS: 14, QUIZ: 15 };

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
// one row per student; sending again updates the same row
function saveFeedback_(p, email, now) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(FEEDBACK_TAB) || ss.insertSheet(FEEDBACK_TAB, ss.getNumSheets());
  const head = sh.getRange(1, 1, 1, FEEDBACK_HEADERS.length).getValues()[0];
  if (head.join("|") !== FEEDBACK_HEADERS.join("|")) sh.getRange(1, 1, 1, FEEDBACK_HEADERS.length).setValues([FEEDBACK_HEADERS]);
  const rating = Math.max(0, Math.min(5, Number(p.rating) || 0));
  const comment = String(p.comment || "").slice(0, 600);
  const rowVals = [now, clean_(p.name), email, clean_(p.college), rating || "", /^[=+\-@]/.test(comment) ? "'" + comment : comment];
  const last = sh.getLastRow();
  let row = 0;
  if (last >= 2) {
    const emails = sh.getRange(2, 3, last - 1, 1).getValues();
    for (let i = 0; i < emails.length; i++) if (String(emails[i][0]).trim().toLowerCase() === email) { row = i + 2; break; }
  }
  if (row) sh.getRange(row, 1, 1, rowVals.length).setValues([rowVals]);
  else sh.appendRow(rowVals);
  return { ok: true, status: row ? "updated" : "new" };
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

    if (type === "feedback") return json_(saveFeedback_(p, email, now));

    if (type === "login") {
      if (!row || !digits_(p.whatsapp)) return json_({ ok: false });
      const r = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      if (digits_(r[4]) !== digits_(p.whatsapp)) return json_({ ok: false });
      sheet.getRange(row, COL.ACTIVE).setValue(now);
      return json_({ ok: true, name: r[2], email: r[3], whatsapp: String(r[4]), college: r[5], year: r[6], linkedin: r[7], progress: r[9], tasks: String(r[12] || ""), quiz: String(r[14] || "") });
    }

    const progress = Number(p.progress) || 0;
    const status = progress >= 100 ? "completed" : "registered";

    if (!row) {
      sheet.appendRow([now, status, clean_(p.name), email, clean_(p.whatsapp), clean_(p.college), clean_(p.year), clean_(p.linkedin), p.consent || "", progress, clean_(p.source), now, clean_(p.tasks), Number(p.points) || 0, clean_(p.quiz)]);
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
