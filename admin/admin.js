/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@076156074fe7ae0d27374b213fe0c1b2c4774ae4/admin/admin.js";

await import(ADMIN_CORE_SCRIPT);

/* =========================
   43D - MAIN DOOR HOUSEKEEPING DETAILS
========================== */

(function patchMainDoorHousekeepingDetails() {
  const PATCH_VERSION = "Updated: 2026-05-22 9:56 PM | admin.js";
  const FIRESTORE_REST_API_KEY = "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648";
  const ROOM_SETTINGS_REST_URL = "https://firestore.googleapis.com/v1/projects/gms-task-tracker/databases/(default)/documents/room_settings";
  const TASK_OPTIONS = ["Clean", "Vac", "Fridge", "Bath", "Mop", "Toilet", "Sink", "Dust", "Bed", "AC Filter"];
  let selectedTaskButtons = [];
  let currentDoorKey = "";

  function makeDoorKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "door";
  }

  function getSelectedDoorInfo() {
    const selectedType = sessionStorage.getItem("mainDoorSelectedType") || "room";
    const selectedRoom = sessionStorage.getItem("mainDoorSelectedRoom") || "";
    const selectedAreaName = sessionStorage.getItem("mainDoorSelectedAreaName") || "";
    const selectedAreaId = sessionStorage.getItem("mainDoorSelectedAreaId") || "";
    const doorName = selectedType === "room" && selectedRoom ? "Room " + selectedRoom : selectedAreaName;
    const doorKey = selectedRoom || makeDoorKey(selectedAreaName || selectedAreaId || doorName);

    return {
      selectedType: selectedType,
      selectedRoom: selectedRoom,
      selectedAreaName: selectedAreaName,
      selectedAreaId: selectedAreaId,
      doorName: doorName || "Selected Door",
      doorKey: doorKey
    };
  }

  function readFirestoreValue(value) {
    if (!value) return "";
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    if (Object.prototype.hasOwnProperty.call(value, "arrayValue")) {
      return (value.arrayValue.values || []).map(readFirestoreValue);
    }
    return "";
  }

  function toFirestoreFields(data) {
    return {
      roomKey: { stringValue: String(data.roomKey || "") },
      roomName: { stringValue: String(data.roomName || "") },
      doorType: { stringValue: String(data.doorType || "") },
      isDaily: { booleanValue: !!data.isDaily },
      isOccupied: { booleanValue: !!data.isOccupied },
      residentStatus: { stringValue: String(data.residentStatus || "") },
      hasDehumidifier: { booleanValue: !!data.hasDehumidifier },
      hkTaskButtons: {
        arrayValue: {
          values: (data.hkTaskButtons || []).map(function(taskName) {
            return { stringValue: String(taskName || "") };
          })
        }
      },
      updatedAt: { timestampValue: new Date().toISOString() },
      updatedBy: { stringValue: "Admin Main Door" }
    };
  }

  function setButtonActive(id, active) {
    const btn = document.getElementById(id);
    if (btn) btn.classList.toggle("active-quick-floor", !!active);
  }

  function getHousekeepingControls() {
    return {
      weeklyBtn: document.getElementById("mainDoorHkWeeklyBtn"),
      dailyBtn: document.getElementById("mainDoorHkDailyBtn"),
      occupiedBtn: document.getElementById("mainDoorHkOccupiedBtn"),
      vacantBtn: document.getElementById("mainDoorHkVacantBtn"),
      statusSelect: document.getElementById("mainDoorHkResidentStatus"),
      dehumBtn: document.getElementById("mainDoorHkDehumBtn"),
      taskBox: document.getElementById("mainDoorHkTaskButtons"),
      message: document.getElementById("mainDoorHkMessage")
    };
  }

  function drawTaskButtons() {
    const controls = getHousekeepingControls();
    if (!controls.taskBox) return;

    controls.taskBox.innerHTML = "";
    TASK_OPTIONS.forEach(function(taskName) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.innerText = taskName;
      btn.className = "yellow";
      btn.classList.toggle("active-quick-floor", selectedTaskButtons.includes(taskName));
      btn.onclick = function() {
        if (selectedTaskButtons.includes(taskName)) {
          selectedTaskButtons = selectedTaskButtons.filter(function(item) { return item !== taskName; });
        } else {
          selectedTaskButtons.push(taskName);
        }
        drawTaskButtons();
      };
      controls.taskBox.appendChild(btn);
    });
  }

  function applyHousekeepingState(state) {
    const isDaily = !!state.isDaily;
    const isOccupied = state.isOccupied !== false;
    const hasDehumidifier = !!state.hasDehumidifier;
    const controls = getHousekeepingControls();

    setButtonActive("mainDoorHkWeeklyBtn", !isDaily);
    setButtonActive("mainDoorHkDailyBtn", isDaily);
    setButtonActive("mainDoorHkOccupiedBtn", isOccupied);
    setButtonActive("mainDoorHkVacantBtn", !isOccupied);
    setButtonActive("mainDoorHkDehumBtn", hasDehumidifier);

    if (controls.statusSelect) {
      controls.statusSelect.value = state.residentStatus || "";
      controls.statusSelect.disabled = !isOccupied;
    }

    selectedTaskButtons = Array.isArray(state.hkTaskButtons) ? state.hkTaskButtons.slice() : [];
    drawTaskButtons();
  }

  async function loadHousekeepingDetails() {
    const info = getSelectedDoorInfo();
    const message = document.getElementById("mainDoorHkMessage");
    currentDoorKey = info.doorKey;

    if (message) message.innerText = "Loading housekeeping details...";

    try {
      const response = await fetch(ROOM_SETTINGS_REST_URL + "/" + encodeURIComponent(info.doorKey) + "?key=" + encodeURIComponent(FIRESTORE_REST_API_KEY), {
        cache: "no-store"
      });

      if (!response.ok) {
        applyHousekeepingState({
          isDaily: false,
          isOccupied: true,
          residentStatus: "",
          hasDehumidifier: false,
          hkTaskButtons: []
        });
        if (message) message.innerText = "No saved housekeeping details yet.";
        return;
      }

      const data = await response.json();
      const fields = data.fields || {};
      applyHousekeepingState({
        isDaily: !!readFirestoreValue(fields.isDaily),
        isOccupied: fields.isOccupied ? !!readFirestoreValue(fields.isOccupied) : true,
        residentStatus: readFirestoreValue(fields.residentStatus),
        hasDehumidifier: !!readFirestoreValue(fields.hasDehumidifier),
        hkTaskButtons: readFirestoreValue(fields.hkTaskButtons) || []
      });
      if (message) message.innerText = "Housekeeping details loaded.";
    } catch (error) {
      if (message) message.innerText = "Could not load housekeeping details.";
    }
  }

  function readCurrentHousekeepingState() {
    const info = getSelectedDoorInfo();
    const controls = getHousekeepingControls();
    const isDaily = document.getElementById("mainDoorHkDailyBtn") && document.getElementById("mainDoorHkDailyBtn").classList.contains("active-quick-floor");
    const isOccupied = document.getElementById("mainDoorHkOccupiedBtn") && document.getElementById("mainDoorHkOccupiedBtn").classList.contains("active-quick-floor");

    return {
      roomKey: info.doorKey,
      roomName: info.doorName,
      doorType: info.selectedType,
      isDaily: !!isDaily,
      isOccupied: !!isOccupied,
      residentStatus: isOccupied && controls.statusSelect ? controls.statusSelect.value : "",
      hasDehumidifier: document.getElementById("mainDoorHkDehumBtn") && document.getElementById("mainDoorHkDehumBtn").classList.contains("active-quick-floor"),
      hkTaskButtons: selectedTaskButtons.slice()
    };
  }

  async function saveHousekeepingDetails() {
    const message = document.getElementById("mainDoorHkMessage");
    const data = readCurrentHousekeepingState();

    if (message) message.innerText = "Saving housekeeping details...";

    try {
      const response = await fetch(ROOM_SETTINGS_REST_URL + "/" + encodeURIComponent(data.roomKey) + "?key=" + encodeURIComponent(FIRESTORE_REST_API_KEY), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: toFirestoreFields(data) })
      });

      if (!response.ok) throw new Error("Save failed.");

      if (message) message.innerText = "Housekeeping details saved.";
      if (typeof window.showAppMessage === "function") {
        window.showAppMessage("Housekeeping details saved.", "Main Door");
      }
    } catch (error) {
      if (message) message.innerText = "Could not save housekeeping details.";
      if (typeof window.showAppMessage === "function") {
        window.showAppMessage("Could not save housekeeping details.", "Main Door");
      }
    }
  }

  window.setMainDoorHkDailyMode = function(isDaily) {
    setButtonActive("mainDoorHkWeeklyBtn", !isDaily);
    setButtonActive("mainDoorHkDailyBtn", !!isDaily);
  };

  window.setMainDoorHkOccupied = function(isOccupied) {
    const controls = getHousekeepingControls();
    setButtonActive("mainDoorHkOccupiedBtn", !!isOccupied);
    setButtonActive("mainDoorHkVacantBtn", !isOccupied);
    if (controls.statusSelect) {
      controls.statusSelect.disabled = !isOccupied;
      if (!isOccupied) controls.statusSelect.value = "";
    }
  };

  window.toggleMainDoorHkDehumidifier = function() {
    const btn = document.getElementById("mainDoorHkDehumBtn");
    if (btn) btn.classList.toggle("active-quick-floor");
  };

  window.saveMainDoorHousekeepingDetails = saveHousekeepingDetails;

  function ensureHousekeepingDetailsSection() {
    const view = document.getElementById("mainDoorDetailsView");
    if (!view || view.classList.contains("hidden")) return;

    let box = document.getElementById("mainDoorHousekeepingDetailsBox");
    if (!box) {
      const tools = document.getElementById("mainDoorDetailsTools");
      box = document.createElement("div");
      box.id = "mainDoorHousekeepingDetailsBox";
      box.className = "quick-tools-selected-card";
      box.innerHTML = '' +
        '<div class="admin-dashboard-subtitle">Housekeeping Details</div>' +
        '<div class="quick-tools-filter-row">' +
          '<button id="mainDoorHkWeeklyBtn" type="button" onclick="setMainDoorHkDailyMode(false)">WEEKLY</button>' +
          '<button id="mainDoorHkDailyBtn" type="button" onclick="setMainDoorHkDailyMode(true)">DAILY</button>' +
        '</div>' +
        '<div class="quick-tools-filter-row">' +
          '<button id="mainDoorHkOccupiedBtn" type="button" onclick="setMainDoorHkOccupied(true)">OCCUPIED</button>' +
          '<button id="mainDoorHkVacantBtn" type="button" onclick="setMainDoorHkOccupied(false)">VACANT</button>' +
        '</div>' +
        '<label>Resident Status</label>' +
        '<select id="mainDoorHkResidentStatus">' +
          '<option value="">None</option>' +
          '<option value="Assisted">Assisted</option>' +
          '<option value="Depending">Depending</option>' +
          '<option value="Hospice">Hospice</option>' +
        '</select>' +
        '<div class="quick-tools-filter-row">' +
          '<button id="mainDoorHkDehumBtn" type="button" onclick="toggleMainDoorHkDehumidifier()">DEHUMIDIFIER</button>' +
        '</div>' +
        '<div class="admin-dashboard-subtitle">Task Buttons</div>' +
        '<div id="mainDoorHkTaskButtons" class="rooms-grid"></div>' +
        '<button class="green" type="button" onclick="saveMainDoorHousekeepingDetails()">SAVE HOUSEKEEPING</button>' +
        '<div id="mainDoorHkMessage" class="quick-tools-search-label"></div>';

      if (tools && tools.parentNode) {
        tools.parentNode.insertBefore(box, tools);
      } else {
        view.appendChild(box);
      }
    }

    const info = getSelectedDoorInfo();
    if (currentDoorKey !== info.doorKey) {
      loadHousekeepingDetails();
    }
  }

  function updateHousekeepingVersionLabel() {
    document.querySelectorAll("#mainDoorDetailsView .app-version-label, #adminQuickToolsView .app-version-label").forEach(function(label) {
      label.innerText = PATCH_VERSION;
    });
  }

  const observer = new MutationObserver(function() {
    ensureHousekeepingDetailsSection();
    updateHousekeepingVersionLabel();
  });

  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

  window.setInterval(function() {
    ensureHousekeepingDetailsSection();
    updateHousekeepingVersionLabel();
  }, 800);

  updateHousekeepingVersionLabel();
})();
