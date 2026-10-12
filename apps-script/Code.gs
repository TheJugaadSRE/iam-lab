/**
 * Google Apps Script – receives sign-ups from the lab site and appends them to a Sheet.
 * Bind this script to a Google Sheet (Extensions > Apps Script), deploy as Web App:
 *   Execute as: Me   |   Who has access: Anyone
 */
const HEADERS = ["Timestamp", "Type", "Name", "Email", "WhatsApp", "College", "Year", "LinkedIn", "Consent", "Progress %", "Source"];

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  const p = e.parameter;
  sheet.appendRow([
    new Date(), p.type || "signup", p.name || "", p.email || "", p.whatsapp || "",
    p.college || "", p.year || "", p.linkedin || "", p.consent || "", p.progress || "", p.source || ""
  ]);
  return ContentService.createTextOutput("ok");
}
