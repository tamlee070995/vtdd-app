import { google } from "googleapis";

const spreadsheetId = process.env.SPREADSHEET_ID;

function getPrivateKey() {
  return String(process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

export async function readSheetRange(range: string) {
  if (!spreadsheetId) {
    throw new Error("Thiếu SPREADSHEET_ID trong .env.local");
  }

  if (!process.env.GOOGLE_CLIENT_EMAIL) {
    throw new Error("Thiếu GOOGLE_CLIENT_EMAIL trong .env.local");
  }

  if (!process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error("Thiếu GOOGLE_PRIVATE_KEY trong .env.local");
  }

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_CLIENT_EMAIL,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({
    version: "v4",
    auth,
  });

  const res = await sheets.spreadsheets.values.get({
  spreadsheetId,
  range,
  valueRenderOption: "UNFORMATTED_VALUE",
  dateTimeRenderOption: "SERIAL_NUMBER",
  });

  return res.data.values || [];
}