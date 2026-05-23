/* =========================
   ADMIN FULL SAFE BUILD
========================== */

const ADMIN_CORE_SCRIPT =
  "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@076156074fe7ae0d27374b213fe0c1b2c4774ae4/admin/admin.js";

/* =========================
   LOAD CORE APP
========================== */

async function loadAdminCore() {
  try {
    await import(ADMIN_CORE_SCRIPT);

    console.log("✅ Admin core loaded.");

    restoreAdminButtons();

  } catch (error) {

    console.error("❌ Admin core failed to load:", error);

    createEmergencyAdminButtons();
  }
}

/* =========================
   RESTORE ADMIN BUTTONS
========================== */

function restoreAdminButtons() {

  const topButtons = document.getElementById("adminTopButtons");

  if (!topButtons) return;

  if (topButtons.children.length > 0) return;

  topButtons.innerHTML = `
    <button class="yellow" onclick="safeOpen('openMaintenanceDashboard')">
      Maintenance
    </button>

    <button class="yellow" onclick="safeOpen('openRoomSafeCheck')">
      Room Safe Check
    </button>

    <button class="yellow" onclick="safeOpen('openQuickTools')">
      Main Door
    </button>

    <button class="yellow" onclick="safeOpen('openAdminIssues')">
      Issues
    </button>

    <button class="yellow" onclick="safeOpen('openAdminDailyStatus')">
      Daily Status
    </button>

    <button class="yellow" onclick="safeOpen('openEmployees')">
      Employees
    </button>
  `;
}

/* =========================
   EMERGENCY FALLBACK
========================== */

function createEmergencyAdminButtons() {

  const topButtons = document.getElementById("adminTopButtons");

  if (!topButtons) return;

  topButtons.innerHTML = `
    <button class="yellow">
      Core Failed To Load
    </button>

    <button class="yellow">
      Check Internet / CDN
    </button>
  `;
}

/* =========================
   SAFE FUNCTION CALLER
========================== */

function safeOpen(functionName) {

  try {

    if (typeof window[functionName] === "function") {

      window[functionName]();

    } else {

      alert(functionName + " is missing.");

    }

  } catch (error) {

    console.error(error);

    alert("Error opening tool.");
  }
}

/* =========================
   MAIN DOOR HOUSEKEEPING PATCH
========================== */

(function patchMainDoorHousekeepingDetails() {

  console.log("✅ Main Door patch loaded.");

  window.openQuickTools = window.openQuickTools || function () {
    const view = document.getElementById("adminQuickToolsView");

    if (view) {
      view.classList.remove("hidden");
    }
  };

})();

/* =========================
   START APP
========================== */

loadAdminCore();
