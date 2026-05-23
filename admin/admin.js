/* =========================
   ADMIN.JS - SAFE FULL BUILD
========================== */

console.log("✅ Admin.js loaded");

/* =========================
   PAGE STARTUP
========================== */

window.addEventListener("DOMContentLoaded", () => {

  console.log("✅ DOM ready");

  initializeAdminDashboard();

});

/* =========================
   MAIN INITIALIZER
========================== */

function initializeAdminDashboard() {

  restoreAdminButtons();

  setDefaultModeButton();

}

/* =========================
   DEFAULT MODE BUTTON
========================== */

function setDefaultModeButton() {

  const mode2 = document.getElementById("modeTwoButton");

  if (mode2) {
    mode2.classList.add("active-mode");
  }

}

/* =========================
   ADMIN TOOLS BUTTONS
========================== */

function restoreAdminButtons() {

  const topButtons = document.getElementById("adminTopButtons");

  if (!topButtons) {
    console.error("❌ adminTopButtons not found");
    return;
  }

  topButtons.innerHTML = `
  
    <button class="yellow" onclick="openMaintenanceDashboard()">
      Maintenance
    </button>

    <button class="yellow" onclick="openRoomSafeCheck()">
      Room Safe Check
    </button>

    <button class="yellow" onclick="openQuickTools()">
      Main Door
    </button>

    <button class="yellow" onclick="openAdminIssues()">
      Issues
    </button>

    <button class="yellow" onclick="openAdminDailyStatus()">
      Daily Status
    </button>

    <button class="yellow" onclick="openEmployees()">
      Employees
    </button>

  `;

}

/* =========================
   VIEW HELPERS
========================== */

function hideAllViews() {

  document.querySelectorAll("body > div .hidden");

  const views = document.querySelectorAll("[id$='View']");

  views.forEach(view => {
    view.classList.add("hidden");
  });

}

/* =========================
   OPEN MAINTENANCE
========================== */

function openMaintenanceDashboard() {

  hideAllViews();

  const view = document.getElementById("adminMaintenanceDashboardView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   OPEN ROOM SAFE CHECK
========================== */

function openRoomSafeCheck() {

  hideAllViews();

  const view = document.getElementById("adminRoomSafeCheckView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   OPEN QUICK TOOLS
========================== */

function openQuickTools() {

  hideAllViews();

  const view = document.getElementById("adminQuickToolsView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   OPEN ISSUES
========================== */

function openAdminIssues() {

  hideAllViews();

  const view = document.getElementById("adminIssuesView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   OPEN DAILY STATUS
========================== */

function openAdminDailyStatus() {

  hideAllViews();

  const view = document.getElementById("adminDailyStatusView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   OPEN EMPLOYEES
========================== */

function openEmployees() {

  hideAllViews();

  const view = document.getElementById("adminEmployeesView");

  if (view) {
    view.classList.remove("hidden");
  }

}

/* =========================
   BACK BUTTON SUPPORT
========================== */

function backToAdminCategories() {

  hideAllViews();

  const main = document.getElementById("adminView2");

  if (main) {
    main.classList.remove("hidden");
  }

}

/* =========================
   MODE BUTTONS
========================== */

function setHousekeepingMode(mode) {

  const mode2 = document.getElementById("modeTwoButton");
  const mode3 = document.getElementById("modeThreeButton");

  if (mode2) {
    mode2.classList.remove("active-mode");
  }

  if (mode3) {
    mode3.classList.remove("active-mode");
  }

  if (mode === "two" && mode2) {
    mode2.classList.add("active-mode");
  }

  if (mode === "three" && mode3) {
    mode3.classList.add("active-mode");
  }

  console.log("Mode changed:", mode);

}

/* =========================
   REPORT BUTTON
========================== */

function openReportChooser() {

  hideAllViews();

  const reportView = document.getElementById("adminDailyReportView");

  if (reportView) {
    reportView.classList.remove("hidden");
  }

}

/* =========================
   SAFETY LOG
========================== */

window.onerror = function(message, source, line, col, error) {

  console.error("GLOBAL ERROR:", {
    message,
    source,
    line,
    col,
    error
  });

};
