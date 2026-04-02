# CHCA Tech Inspection Prototype

This is a static prototype for a CHCA technical inspection web app that can be hosted on GitHub Pages.

## Included in this build

- Driver and owner information capture
- Dynamic class selector
- Class checklists for all active 2026 CHCA divisions: Sportsman, Stock Car, Open Wheel, Super Sprint, Competition Truck, Super Stock Truck, Championship, Quad, Rally, Junior, Motorcycle, UTV / SXS, and Unlimited
- Class-specific detail fields for Rally, trucks, Quad, Junior, and Motorcycle where the rulebook splits subclasses
- JSON payload preview for backend testing
- Submission hook ready for a Google Apps Script endpoint

Ultra 4 and CrossKart are not in the selector because the 2026 rulebook marks those classes deleted.

## Recommended production setup

1. GitHub Pages hosts the public form.
2. The form sends JSON to a Google Apps Script web app.
3. Apps Script writes the inspection to Google Sheets.
4. Apps Script generates a PDF from a Google Doc or HTML template.
5. Apps Script emails the PDF to the Tech Director, Driver, Owner, and club inbox.

This keeps email and Google credentials off the public site.

## Configure live submission

Edit `tech-data.js` and set:

```js
config: {
  clubEmail: "your-club-inbox@example.org",
  appsScriptUrl: "https://script.google.com/macros/s/your-script-id/exec",
}
```

## Next steps

1. Confirm any class-specific fields you want printed on the PDF for trucks, Quad, Junior, Motorcycle, and Rally.
2. Decide whether Tech Director approval is same-step or a separate review workflow.
3. Expand the Apps Script PDF template to print class-specific details and the full checklist output.
4. Build and deploy the Apps Script backend.
5. Publish to GitHub Pages.
