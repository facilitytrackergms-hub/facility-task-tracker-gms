# AGENTS.md — Housekeeping App Rules

## 01 - Core Update Rules

01.01 - Read and follow this file before making code changes.

01.02 - Update directly in GitHub using the repo and file listed in the request.

01.03 - Use a download only when direct GitHub update fails or the user specifically asks for a full file.

01.04 - Update main directly. Create a pull request only when the user specifically asks for one.

01.05 - Change only what is necessary for the requested update.

01.06 - Keep unrelated layout, logic, views, styling, text, and behavior unchanged.

01.07 - Preserve existing working behavior unless the task specifically says to change it.

01.08 - Keep exact file names. If the file is `index.html`, `admin.html`, `schedule.html`, `reports.html`, `history.html`, or `tasks.html`, keep that name.

01.09 - Use the latest current version of each file as the starting point.

01.10 - Keep the work focused on the requested update.

## 02 - Output Rules

02.01 - When using GitHub direct updates, commit the change to `main` and report the changed file.

02.02 - If a direct GitHub update is blocked, explain the block and give the smallest safe fallback.

02.03 - If asked to return a full file, return the full updated file only.

02.04 - If a current file is missing or cannot be inspected, say which file is needed.

02.05 - If replacement instructions are requested instead of a full file, include the exact start marker and exact end marker.

02.06 - If more than three manual edits would be required, update the full file instead of giving many copy/paste steps.

## 03 - Version Label Rule

03.01 - Every time any app file is updated, update the visible version/date/time label at the bottom of every view touched by that file.

03.02 - The label must include the current date, current time, and exact file name.

03.03 - Example:

`Updated: 2026-05-19 3:45 PM | index.html`

03.04 - Apply this automatically unless the request specifically says to leave the version label unchanged.

## 04 - Code Organization Rules

04.01 - Keep helpful numbered section headers inside the code when they already exist.

04.02 - Use numbered section headers in comments like:

`01 - LOGIN`

`02 - GLOBAL STYLE`

04.03 - Use main section numbers like `01`, `02`, and `03`.

04.04 - If adding a new part between existing sections, use decimals like `05.1` or `05.2`.

04.05 - Keep the code readable and normally formatted.

## 05 - UI Rules

05.01 - Keep phone layouts compact.

05.02 - Avoid unnecessary buttons, duplicate save buttons, extra controls, and screen clutter.

05.03 - Keep existing edit/delete buttons unless the task specifically says to remove them.

05.04 - Use custom in-app popups.

05.05 - Avoid browser `alert()`, `confirm()`, or `prompt()` boxes.

05.06 - Keep user-facing text clear, short, and readable in American English.

## 06 - Fast and Cheap App Rule

06.01 - Choose the coding path that keeps the app fast, reliable, and low-cost to run.

06.02 - When adding or changing Firestore logic, minimize unnecessary reads, writes, deletes, listeners, duplicate records, and repeated data loading.

06.03 - Use targeted Firestore queries or already-loaded app data when that safely fits the task.

06.04 - Write to Firestore only when data actually changed.

06.05 - Update only the necessary fields instead of rewriting full records when possible.

06.06 - Use one-time reads when live updates are not needed.

06.07 - Clean up listeners when leaving a view so they do not keep reading in the background.

06.08 - Avoid loops that repeatedly read or write the same Firestore data.

06.09 - Use batch writes when multiple related updates must be saved together.

06.10 - Reuse existing app state, sessionStorage, localStorage, or already-loaded data when it is safe and appropriate.

06.11 - Keep the app responsive when changing views. Avoid slow view loading, unnecessary reloads, and logic that can cause timeouts.

06.12 - Keep reliability, correct data, and clean user flow as priorities.

06.13 - The goal is: fast app, low Firestore cost, good code, and no broken behavior.

## 07 - App Logic Safety Rules

07.01 - Keep unrelated Firebase, Firestore, login, schedule, report, admin, and history logic unchanged.

07.02 - Keep Google Sheet structure unchanged unless the task specifically says to change it.

07.03 - Keep Firestore structure unchanged unless the task specifically says to change it.

07.04 - Avoid duplicate room, area, hallway, equipment, task, or location records.

07.05 - Keep normal Admin Dashboard behavior working.

07.06 - Keep normal user schedule behavior working.

07.07 - Keep admin edit controls limited to users with admin permission.

## 08 - One Door Method

08.01 - Use the One Door Method.

08.02 - A room, area, hallway, equipment item, or location must keep one shared identity/key across all views.

08.03 - Weekly, Daily, Dehumidifier, Laundry, Admin, Reports, Maintenance, PTAC, and future views are only access points into the same shared door.

08.04 - The same room or area must not be duplicated just because it appears in more than one view.

08.05 - Use one shared identity/key and shared core status wherever possible.

08.06 - Avoid fake duplicate area IDs when the existing shared door identity should be used.

## 09 - Permission Rules

09.01 - Housekeeping and Laundry employees should be able to view both Housekeeping and Laundry by default.

09.02 - Extra views such as Admin, PTAC, Maintenance, Reports, and editing rights remain manual permissions.

09.03 - Keep admin-only controls limited to admin users.

09.04 - Admin edit buttons should only appear for users with admin permission.

## 10 - Request Interpretation Rules

10.01 - Treat user wording as rough instructions.

10.02 - Silently fix spelling and grammar.

10.03 - Infer the intent when it is obvious.

10.04 - Make the requested update in clear American English.

10.05 - If the request is ambiguous in a way that could damage working code, ask for clarification before coding.

## 11 - Repair and Audit Rules

11.01 - For audit requests, inspect the current implementation first.

11.02 - For audit requests, report what currently works, what fails, which files/functions are involved, and the safest repair plan.

11.03 - For audit-only tasks, report findings without editing code.

11.04 - For repair requests, make the smallest safe fix based on the current files.

11.05 - Use existing functions and current app structure whenever possible.

11.06 - Keep unrelated improvements out of repair work.

11.07 - Before changing a complex flow, identify the current source functions and return functions first.

11.08 - Before finishing any repair task, review the final changed file for syntax errors, duplicate function declarations, duplicate buttons, duplicate version labels, broken HTML tags, missing closing tags, and unfinished partial replacements.

11.09 - After editing, inspect the final version of every touched section, not only the diff.

11.10 - If JavaScript was changed, check that every edited function has one valid declaration, proper opening and closing braces, and no accidental nested or duplicate function declarations.

11.11 - If HTML was changed, check that visible buttons, labels, inputs, controls, and version labels were not duplicated unless the task specifically requested duplicates.

11.12 - If version labels are updated, replace the old visible version label instead of adding a second version label.

11.13 - If a button action is changed, verify that the old button was replaced instead of leaving both the old and new buttons visible.

11.14 - Finish repair tasks only after every touched file has passed this final self-review.

## 12 - Spreadsheet Update Request Rule

12.01 - If an update request is provided from a spreadsheet, read and follow the request from the update-request column.

12.02 - Apply the request to the correct file named in the spreadsheet.

12.03 - Keep unrelated files and unrelated spreadsheet structure unchanged.

12.04 - If the spreadsheet refers to column C as the update request column, treat column C as the main instruction source.

## 13 - Admin Edit Flow Rule

13.01 - The black “A” button means go to the main Admin Dashboard.

13.02 - The Edit button means edit the exact thing currently being viewed and then return to the same schedule position.

13.03 - When an admin starts editing from `schedule.html`, save a clear return ticket before leaving the page.

13.04 - The return ticket should preserve the current schedule context, including assignment, category, weekday/date, area, room, task view, and edit source.

13.05 - After save, cancel, or back from the admin editor, return to `schedule.html` only when a schedule return ticket exists.

13.06 - If no schedule return ticket exists, keep normal admin behavior.

13.07 - When returning to `schedule.html`, reload needed data and restore the same view when possible.

13.08 - Clear the return ticket only after restore succeeds.

13.09 - If the exact area or task cannot be restored, fall back to the same category area list first, then the main category/dashboard view.

13.10 - Prevent loops between `admin.html` and `schedule.html`.
