# School Visit Reporting Tool

This ZIP contains a starter MERN-style project with:

- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **School Master Source:** Google Sheets API
- **Database:** MongoDB
- **Image Uploads:** Cloudinary
- **PDF Generation:** Puppeteer
- **Emails:** Nodemailer (SMTP)

## 1) What this app does

- Reads school master data from your Google Sheet
- Shows **State -> School** dropdowns
- Auto-fills school details
- Lets a program manager submit a visit report
- Uploads session photos
- Generates a PDF
- Emails the school
- Stores report history in MongoDB
- Shows yearly tracking by school

---

## 2) Project structure

```text
school-visit-app/
  backend/
  frontend/
  README.md
```

---

## 3) Before you run it

You need these 5 things ready:

1. **Google Sheet** with your school data
2. **Google Cloud service account**
3. **MongoDB**
4. **Cloudinary account**
5. **SMTP email account** for sending emails

---

## 4) Exact file where you add each credential

All backend credentials go in:

```text
backend/.env
```

Create it by copying:

```text
backend/.env.example
```

### These are the exact env fields

#### A. MongoDB
Add in `backend/.env`:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/school_visit_app
```

If you use MongoDB Atlas, replace it with your Atlas connection string.

---

#### B. Frontend URL
Add in `backend/.env`:

```env
FRONTEND_URL=http://localhost:5173
```

For production, change it to your real website URL.

---

#### C. Google Sheet ID
Add in `backend/.env`:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_google_sheet_id
```

### How to get Sheet ID
If your sheet URL is:

```text
https://docs.google.com/spreadsheets/d/1AbCdEfGhIJkLmNoPqRsTuVwXyZ1234567890/edit#gid=0
```

Then your Sheet ID is:

```text
1AbCdEfGhIJkLmNoPqRsTuVwXyZ1234567890
```

Paste that value into:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=1AbCdEfGhIJkLmNoPqRsTuVwXyZ1234567890
```

---

#### D. Google Sheet range
Add in `backend/.env`:

```env
GOOGLE_SHEETS_RANGE=Deliverables tracking!A:Z
```

Keep this exactly unless your source tab name or columns change.

---

#### E. Google service account email
Add in `backend/.env`:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project-id.iam.gserviceaccount.com
```

---

#### F. Google private key
Add in `backend/.env`:

```env
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_KEY_LINE_1\nYOUR_KEY_LINE_2\n-----END PRIVATE KEY-----\n"
```

### Very important
- keep the whole key inside quotes
- keep `\n` line breaks exactly like that

---

#### G. Cloudinary
Add in `backend/.env`:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

#### H. SMTP email
Add in `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
MAIL_FROM_NAME=Your Organization Name
MAIL_FROM_EMAIL=your_email@example.com
MAIL_CC=
```

If using Gmail, use an **App Password**, not your normal password.

---

## 5) How to create Google Sheets API access

### Step 1
Go to Google Cloud Console and create a project.

### Step 2
Enable **Google Sheets API**.

### Step 3
Create a **Service Account**.

### Step 4
Create a JSON key for that service account.

From that JSON file, take:

- `client_email` -> use as `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `private_key` -> use as `GOOGLE_PRIVATE_KEY`

### Step 5
Open your Google Sheet and share it with the service account email as **Viewer**.

Example:
```text
service-account@project-id.iam.gserviceaccount.com
```

Without this, the backend cannot read the sheet.

---

## 6) Which Google Sheet columns this app expects

Your source tab is expected to be:

```text
Deliverables tracking
```

It looks for these column headers:

- `School Name`
- `City` or `City `
- `State`
- `Point of Contact`
- `Designation`
- `Contact No`
- `Email`
- `Course Selected (2026-2027)`

### Important
Keep these header names the same.

---

## 7) How to run locally

## Backend

Open terminal:

```bash
cd school-visit-app/backend
npm install
cp .env.example .env
```

Now open `.env` and replace all placeholder values with your real values.

Then run:

```bash
npm run dev
```

Backend should start at:

```text
http://localhost:5000
```

Test it in browser:

```text
http://localhost:5000/api/health
```

You should see:

```json
{"success":true,"message":"API is running"}
```

---

## Frontend

Open another terminal:

```bash
cd school-visit-app/frontend
npm install
npm run dev
```

Frontend should start at:

```text
http://localhost:5173
```

Open that URL in your browser.

---

## 8) Important frontend API file

If your backend URL changes, update this file:

```text
frontend/src/api/client.js
```

Current value:

```javascript
baseURL: 'http://localhost:5000/api'
```

### For production example
Change it to:

```javascript
baseURL: 'https://yourdomain.com/api'
```

---

## 9) Main files you may edit later

### To change email HTML
Edit:

```text
backend/src/utils/htmlReportTemplate.js
```

### To change Google Sheets parsing logic
Edit:

```text
backend/src/services/sheets.service.js
```

### To change PDF generation
Edit:

```text
backend/src/services/pdf.service.js
```

### To change report save logic
Edit:

```text
backend/src/controllers/report.controller.js
```

### To change frontend form
Edit:

```text
frontend/src/components/SchoolVisitForm.jsx
```

### To change tracking dashboard
Edit:

```text
frontend/src/components/TrackingDashboard.jsx
```

---

## 10) First test flow

1. Start backend
2. Start frontend
3. Open frontend in browser
4. Choose a **State**
5. Choose a **School**
6. Confirm email auto-fills
7. Fill Program Manager Name
8. Fill Purpose of Visit
9. Fill Visit Date
10. Fill Session Summary
11. Upload 1 small image
12. Click **Send Report**

Expected result:
- photos upload to Cloudinary
- PDF gets generated
- email is sent
- report is saved in MongoDB
- tracking dashboard can load that report

---

## 11) Common errors and fixes

### Error: Google sheet not loading
Check:
- Sheet ID is correct
- Service account email is correct
- Sheet is shared with service account
- Range is correct
- Header names are correct

### Error: Email not sending
Check:
- SMTP host/user/pass
- Gmail App Password
- firewall or SMTP restrictions

### Error: Photos not uploading
Check:
- Cloudinary env values
- internet access
- file size is not too large

### Error: MongoDB not connecting
Check:
- MongoDB URI
- local MongoDB service is running
- Atlas IP whitelist if using Atlas

### Error: Puppeteer fails on server
On some servers you may need extra Chromium dependencies.
For local testing it usually works fine.

---

## 12) Production deploy idea

### Frontend
Deploy React app to:
- Vercel
- Netlify
- your own server

### Backend
Deploy Node app to:
- Render
- Railway
- VPS
- your own server

### MongoDB
Use:
- MongoDB Atlas

### Then
Set:
- `FRONTEND_URL`
- `baseURL` in `frontend/src/api/client.js`

to production URLs.

---

## 13) Your next best improvement

After you confirm this starter works, the next upgrades should be:

- login/auth for program managers
- admin-only dashboard
- cache Google Sheets data for a few minutes
- resend failed email button
- upload generated PDF to Cloudinary/S3 and store URL
- stronger validation and better error handling
