import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

let writeQueue: Promise<any> = Promise.resolve();

function enqueueWrite<T>(job: () => Promise<T>) {
  const nextJob = writeQueue.then(job, job);

  writeQueue = nextJob
    .then(() => undefined)
    .catch(() => undefined);

  return nextJob;
}

function getSpreadsheetId() {
  const spreadsheetId = process.env.SPREADSHEET_ID;

  if (!spreadsheetId) {
    throw new Error("Thiếu SPREADSHEET_ID trong .env.local");
  }

  return spreadsheetId;
}

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error("Thiếu GOOGLE_CLIENT_EMAIL hoặc GOOGLE_PRIVATE_KEY trong .env.local");
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: SCOPES,
  });
}

function colLetter(index: number) {
  let s = "";

  while (index > 0) {
    const m = (index - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    index = Math.floor((index - 1) / 26);
  }

  return s;
}

function toCellValue(value: any) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      userEnteredValue: {
        numberValue: value,
      },
    };
  }

  if (typeof value === "boolean") {
    return {
      userEnteredValue: {
        boolValue: value,
      },
    };
  }

  return {
    userEnteredValue: {
      stringValue: String(value ?? ""),
    },
  };
}

async function getSheetsClient() {
  const auth = getGoogleAuth();

  return google.sheets({
    version: "v4",
    auth,
  });
}

async function ensureSheetAndHeaders(sheetName: string, headers: string[]) {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
  });

  const targetSheet = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  let sheetId = targetSheet?.properties?.sheetId;

  if (sheetId === undefined || sheetId === null) {
    const created = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: sheetName,
              },
            },
          },
        ],
      },
    });

    sheetId = created.data.replies?.[0]?.addSheet?.properties?.sheetId;

    if (sheetId === undefined || sheetId === null) {
      throw new Error("Không tạo được sheet log.");
    }
  }

  const lastCol = colLetter(headers.length);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1:${lastCol}1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [headers],
    },
  });

  return {
    sheets,
    spreadsheetId,
    sheetId,
  };
}

async function insertSheetRowAt2Atomic(sheetName: string, headers: string[], row: any[]) {
  const { sheets, spreadsheetId, sheetId } = await ensureSheetAndHeaders(sheetName, headers);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          insertDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: 1,
              endIndex: 2,
            },
            inheritFromBefore: false,
          },
        },
        {
          updateCells: {
            start: {
              sheetId,
              rowIndex: 1,
              columnIndex: 0,
            },
            rows: [
              {
                values: row.map(toCellValue),
              },
            ],
            fields: "userEnteredValue",
          },
        },
      ],
    },
  });
}

export async function insertSheetRowAt2Queued(sheetName: string, headers: string[], row: any[]) {
  return enqueueWrite(() => insertSheetRowAt2Atomic(sheetName, headers, row));
}
