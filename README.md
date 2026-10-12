# TheJugaadSRE · Cloud Security with AWS IAM (Interactive Lab)

Static site (HTML/CSS/JS). Hosts free on GitHub Pages.

## 1. Collect leads in a private Google Sheet (5 min)
1. Create a new Google Sheet (keep it **private**).
2. Extensions → Apps Script → paste `apps-script/Code.gs` → Save.
3. Deploy → New deployment → type **Web app** → Execute as **Me**, access **Anyone** → Deploy → copy the URL.
4. Paste the URL into `LEAD_ENDPOINT` in `config.js`. Also set `CONTACT_EMAIL` and your social links.

One row per student (keyed by email). Progress and "completed" status update on the same row. After ANY edit to Code.gs: Deploy > Manage deployments > Edit > New version > Deploy.

## 2. Publish on GitHub Pages
```bash
cd iam-lab
git init -b main
git add .
git commit -m "TheJugaadSRE IAM lab"
git remote add origin https://github.com/TheJugaadSRE/iam-lab.git
git push -u origin main
```
Then repo → Settings → Pages → Source: **Deploy from branch**, `main` / `/ (root)`.
URL: `https://TheJugaadSRE.github.io/iam-lab/` (make a QR code of it for the auditorium).

## Notes
- The gate is a lead-capture form, not security: the page source is public. That's fine for a free lab.
- Consent is required and worded clearly (India's DPDP Act expects free, specific, informed consent and an easy opt-out). Honour "STOP" and deletion requests.
- Anyone can POST to the Apps Script URL; treat the Sheet as untrusted input (don't open CSVs blindly in Excel).
