# ServiceHub Admin — Apps Script edition

This is the separate ServiceHub Admin frontend. It is configured for live Apps Script mode; there is no hard-coded admin username or password in the frontend.

## 1. Prepare the spreadsheet

Spreadsheet ID is already set in `Code.gs`: `1F7QIvE3SH-0eifmNrDp9zIDkMMd-eWm1odNjIMsoCrU`. The script uses the existing tabs where found and creates missing tabs/columns as needed. Tab names supported include `Admin info` / `Admins`, `Listings`, `Manage Links (Private)`, `Payments`, and `Access code`.

- Add the private access code in **column A** of the `Access code` tab. You can put a header in A1 and the actual code below it; if A1 itself is the code, it is accepted too.
- The Admin info tab's existing `username`, `password`, `first name`, etc. columns are preserved. The script adds all fields requested by the application, status/review columns, and `Password Salt` / `Password Hash`. Passwords are never written in plaintext; an old `password` column is left unused.
- The first admin must apply using `apply.html`. Then manually set that row's `Status` to `approved` in the Admin info tab. Optionally set `Role` to `owner`. This is the bootstrap step; no default login exists.
- For a listing's management link, the script reads the private `Manage Links (Private)` tab. The link is not returned to the frontend until the user clicks Copy and re-enters the password.

## 2. Create the Apps Script project

1. Open [script.google.com](https://script.google.com) and create a **new standalone project** (separate from any existing ServiceHub Apps Script).
2. Replace the contents of `Code.gs` with the supplied `Code.gs` file.
3. In Project Settings, set the timezone appropriately for your operations. Run `doGet` once in the editor and authorize access to the spreadsheet when prompted.
4. Deploy → New deployment → **Web app**. Execute as **Me**. Set access to **Anyone** so the public static frontend can call it; the backend itself checks the access code, session, approval status and password for each protected operation. Copy the `/exec` URL.
5. Paste that URL into `API_URL` in `js/config.js`, replacing `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE`. Keep `MODE: 'live'`.
6. Publish the frontend ZIP as a separate static site. Do not publish the Apps Script source as a public website.

## 3. Admin directory behavior

`admin-info.html` is accessible without an admin username or signed-in session. It sends no applicant details until the access code in column A has been confirmed by Apps Script. The page opens on **Pending** by default. Tap **All admins** or swipe right to see all applications; swipe left to return to Pending. The access code is held only in the request and is not saved in browser storage.

## 4. Admin session and sensitive actions

- Login uses the username and salted SHA-256 password hash stored in the Admin info tab. An account must have `Status` = `approved`.
- The signed-in username is remembered in the current tab session and automatically sent with password re-checks. The server verifies that it matches the session and checks the password for that same admin; another admin's password will not work.
- Manage links are only requested from the server after the Copy action and password confirmation. Listing data never contains the link itself.
- Admin directory access code attempts are rate-limited and logged. Mutations and sensitive events are written to `AdminLog`.
- The backend uses the sheet's header names and adds missing columns. Back up the spreadsheet before first deployment.

## Notes

- Test with a non-critical copy of the spreadsheet first. Apps Script deployment permissions and Google account policy can affect whether public calls work.
- `admin-info.html` intentionally exposes the application details to anyone who knows the access code, as requested. Keep that code private and rotate it by changing column A.
- Subscription expiry behavior is a generic 30-day month calculation in this standalone backend. If ServiceHub already has a specific expiry rule, replace that calculation in `extend_()` before using it operationally.
