/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@3d40f422992c269dff7428c8db915c3e56c2b362/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43F - MAIN DOOR COMPACT SELECTOR
========================== */

(function patchMainDoorCompactSelector() {
  const PATCH_VERSION = "Updated: 2026-05-22 10:24 PM | admin.js";

  function addCompactStyle() {
    if (document.getElementById("mainDoorCompactSelectorStyle")) return;

    const style = document.createElement("style");
    style.id = "mainDoorCompactSelectorStyle";
    style.textContent = `
      #adminQuickToolsView .admin-dashboard-subtitle {
        margin: 5px 0 2px !important;
        font-size: 12px !important;
        line-height: 1.05 !important;
      }

      #adminQuickToolsView .quick-tools-filter-row,
      #adminQuickToolsView .weekday-row {
        gap: 4px !important;
        margin: 4px 0 !important;
      }

      #quickToolsScheduleRow {
        grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
      }

      #quickToolsTypeRow {
        grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      }

      #quickToolsFloorRow {
        grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      }

      #quickToolsWeekdayRow {
        grid-template-columns: repeat(7, minmax(0, 1fr)) !important;
      }

      #adminQuickToolsView .quick-tools-filter-row button,
      #adminQuickToolsView .weekday-row button {
        min-height: 31px !important;
        font-size: 10.5px !important;
        padding: 4px 2px !important;
        border-radius: 8px !important;
        line-height: 1 !important;
        white-space: nowrap !important;
      }

      #adminQuickToolsView button.active-quick-floor,
      #adminQuickToolsView button.active-day {
        outline-width: 2px !important;
        outline-offset: -2px !important;
      }

      #quickToolsRoomSearchBox .quick-tools-search-label,
      #quickToolsAreaSearchBox .quick-tools-search-label {
        margin-top: 5px !important;
        font-size: 13px !important;
      }

      #quickToolsRoomSearchInput {
        min-height: 38px !important;
        font-size: 18px !important;
        padding: 7px !important;
        margin: 4px 0 6px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function normalizeMainDoorSelector() {
    const scheduleRow = document.getElementById("quickToolsScheduleRow");
    const weekdayRow = document.getElementById("quickToolsWeekdayRow");
    const floorOneButton = document.getElementById("quickToolsFloor1Button");

    if (floorOneButton && floorOneButton.parentElement) {
      floorOneButton.parentElement.id = "quickToolsFloorRow";
    }

    [scheduleRow, weekdayRow].forEach(function(row) {
      if (!row) return;
      Array.from(row.querySelectorAll("button")).forEach(function(button) {
        if (String(button.innerText || "").trim().toUpperCase() === "ALL") {
          button.remove();
        }
      });
    });

    const scheduleTitle = document.getElementById("quickToolsScheduleTitle");
    if (scheduleTitle) scheduleTitle.innerText = "Choose schedule";

    const weekdayTitle = document.getElementById("quickToolsWeekdayTitle");
    if (weekdayTitle) weekdayTitle.innerText = "Choose day";

    document.querySelectorAll("#adminQuickToolsView .app-version-label, #mainDoorDetailsView .app-version-label").forEach(function(label) {
      label.innerText = PATCH_VERSION;
    });
  }

  function runPatch() {
    addCompactStyle();
    normalizeMainDoorSelector();
  }

  const observer = new MutationObserver(runPatch);
  observer.observe(document.body, { childList: true, subtree: true });

  window.setInterval(runPatch, 500);
  runPatch();
})();
