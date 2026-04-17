const CHCA_CONFIG = {
  sheetId: "1_88PXNH1wabxjs448GM_K2YOPGRwrAZvaCQsQF8TAaI",
  sheetNamesByInspectionType: {
    Annual: "Annual",
    "Re-Tech": "Re-Tech",
  },
  pdfFolderId: "1p2VRyS4ua0PWmdA6QJ-cHSyoLMQK-RKZ",
  appName: "CHCA Tech Inspection",
  techDirectorEmail: "chcatech07@gmail.com",
};

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    validatePayload_(payload);

    const sheet = getSheet_(payload);
    const row = buildSheetRow_(payload);
    sheet.appendRow(row);

    const pdfFile = createPdf_(payload);
    sendEmails_(payload, pdfFile);

    return jsonResponse_({
      ok: true,
      message: "Saved to sheet, generated PDF, and emailed recipients.",
      pdfFileId: pdfFile.getId(),
      pdfFileName: pdfFile.getName(),
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      message: error.message,
    });
  }
}

function validatePayload_(payload) {
  if (!payload || !payload.inspection) {
    throw new Error("Missing inspection payload.");
  }

  const inspection = payload.inspection;
  if (!inspection.vehicleClass) {
    throw new Error("Vehicle class is required.");
  }

  if (!inspection.driver || !inspection.driver.name || !inspection.driver.email) {
    throw new Error("Driver name and email are required.");
  }
}

function getSheet_(payload) {
  const inspectionType = payload.inspection?.inspectionType || "";
  const sheetName = CHCA_CONFIG.sheetNamesByInspectionType[inspectionType];

  if (!sheetName) {
    throw new Error(`No sheet tab is configured for inspection type "${inspectionType}".`);
  }

  const spreadsheet = SpreadsheetApp.openById(CHCA_CONFIG.sheetId);
  const sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(`Sheet "${sheetName}" not found.`);
  }

  return sheet;
}

function buildSheetRow_(payload) {
  const inspection = payload.inspection;

  return [
    new Date(),
    inspection.inspectionType || "",
    inspection.result?.overallResult || "",
    inspection.result?.requiredCorrections || "",
    inspection.classLabel || inspection.vehicleClass || "",
    inspection.carNumber || "",
    inspection.driver?.name || "",
    inspection.driver?.email || "",
    inspection.driver?.phone || "",
    inspection.owner?.name || "",
    inspection.owner?.email || "",
    inspection.owner?.phone || "",
    inspection.vehicle?.description || "",
    inspection.result?.carStickerNumber || "",
    inspection.inspectorName || "",
    inspection.result?.inspectorSignature || "",
    inspection.result?.technicalDirectorApproval || "",
  ];
}

function createPdf_(payload) {
  const inspection = payload.inspection;
  const template = HtmlService.createTemplateFromFile("inspection-pdf-template");
  template.payload = payload;

  const html = template.evaluate().getContent();
  const blob = Utilities.newBlob(html, "text/html", "inspection.html").getAs("application/pdf");
  const fileName = [
    "CHCA-Tech",
    safeFilePart_(inspection.carNumber || "Car"),
    safeFilePart_(inspection.driver?.name || "Driver"),
  ].join("-") + ".pdf";

  blob.setName(fileName);

  const folder = DriveApp.getFolderById(CHCA_CONFIG.pdfFolderId);
  return folder.createFile(blob);
}

function sendEmails_(payload, pdfFile) {
  const inspection = payload.inspection;
  const recipients = [
    CHCA_CONFIG.techDirectorEmail,
    inspection.recipients?.driverEmail,
    inspection.recipients?.ownerEmail,
    inspection.recipients?.clubEmail,
  ].filter(Boolean);

  if (!recipients.length) {
    return;
  }

  const subject = `${CHCA_CONFIG.appName}: ${inspection.classLabel || inspection.vehicleClass} #${inspection.carNumber} ${inspection.result?.overallResult || ""}`.trim();
  const body = [
    "A technical inspection has been submitted.",
    "",
    `Class: ${inspection.classLabel || inspection.vehicleClass || ""}`,
    `Car #: ${inspection.carNumber || ""}`,
    `Driver: ${inspection.driver?.name || ""}`,
    `Result: ${inspection.result?.overallResult || ""}`,
    "",
    "The completed inspection PDF is attached.",
  ].join("\n");

  MailApp.sendEmail({
    to: recipients.join(","),
    subject,
    body,
    attachments: [pdfFile.getBlob()],
  });
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function safeFilePart_(value) {
  return String(value).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
}

