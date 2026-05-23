/* =========================
   11 - ADMIN CORE LOADER
========================== */

const ADMIN_CORE_SCRIPT = "https://cdn.jsdelivr.net/gh/facilitytrackergms-hub/facility-task-tracker-gms@076156074fe7ae0d27374b213fe0c1b2c4774ae4/admin/admin.js";

try {
  await import(ADMIN_CORE_SCRIPT);
} catch (error) {
  console.warn("Admin core script did not load. Local fallback is active.", error);
}


/* =========================
   12 - LOCAL ADMIN FALLBACK
========================== */

(function localAdminFallback() {
  const LOCAL_VERSION = "Updated: 2026-05-22 10:21 PM | admin.js";
  const FIRESTORE_REST_API_KEY = "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648";
  const AREAS_REST_URL = "https://firestore.googleapis.com/v1/projects/gms-task-tracker/databases/(default)/documents/areas";
  let quickToolsMode = "rooms";
  let quickToolsFloor = "1";
  let fallbackAreas = [];
  let fallbackAreasLoaded = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function showView(id) {
    document.querySelectorAll(".card > div[id]").forEach(function(view) {
      if (view.id !== "loadingScreen" && view.id !== "appMessageBox") view.classList.add("hidden");
    });
    const target = byId(id);
    if (target) target.classList.remove("hidden");
    updateVersionLabels();
  }

  function updateVersionLabels() {
    document.querySelectorAll(".app-version-label").forEach(function(label) {
      if (label.innerText.indexOf("admin.html") !== -1) {
        label.innerText = "Updated: 2026-05-22 10:21 PM | admin.html";
      }
    });
  }

  function setActive(id, active, cls) {
    const item = byId(id);
    if (item) item.classList.toggle(cls || "active-quick-floor", !!active);
  }

  function makeButton(text, fn, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerText = text;
    if (className) button.className = className;
    button.onclick = fn;
    return button;
  }

  function drawAdminTopButtons() {
    const box = byId("adminTopButtons");
    if (!box) return;
    box.innerHTML = "";
    [
      ["Schedule Editor", window.openScheduleEditorFromAdmin || window.openScheduleEditor],
      ["Main Door", window.openQuickToolsView],
      ["Rooms Assignments", window.openRoomSafeCheck],
      ["Maintenance", window.openMaintenanceDashboard || window.openMaintenanceInspection],
      ["PTAC", window.openPtacDashboard],
      ["Issues", window.openIssues],
      ["Daily Status", window.openDailyStatus],
      ["Issue Reasons", window.openIssueReasons]
    ].forEach(function(item, index) {
      const button = makeButton((index + 1) + ". " + item[0], function() {
        if (typeof item[1] === "function") item[1]();
      }, "yellow");
      box.appendChild(button);
    });
  }

  window.backToAdminCategories = window.backToAdminCategories || function() {
    showView("adminView2");
    drawAdminTopButtons();
  };

  window.logout = window.logout || function() {
    window.location.href = "../index.html";
  };

  window.setHousekeepingMode = window.setHousekeepingMode || function(mode) {
    setActive("modeTwoButton", mode === "two", "active-mode");
    setActive("modeThreeButton", mode === "three", "active-mode");
  };

  window.openReportChooser = window.openReportChooser || function() {
    if (typeof window.showAppMessage === "function") {
      window.showAppMessage("Use Main Door to open Room Report or Daily Report.", "Reports");
    } else {
      showView("adminRoomReportView");
    }
  };

  window.openEmployees = window.openEmployees || function() {
    showView("adminEmployeesView");
  };

  window.openScheduleEditorFromAdmin = window.openScheduleEditorFromAdmin || function() {
    showView("adminScheduleEditorView");
    const box = byId("adminAssignmentButtons");
    if (!box) return;
    box.innerHTML = "";
    ["HK1", "HK2", "1stfloor", "2ndFloor", "3rdFloor", "Laundry"].forEach(function(name) {
      box.appendChild(makeButton(name, function() {
        const title = byId("adminScheduleChoiceTitle");
        if (title) title.innerText = "Schedule Editor - " + name;
        showView("adminScheduleChoiceView");
        const categories = byId("adminCategoryButtons");
        if (categories) {
          categories.innerHTML = "";
          ["Common Area", "Weekly Room", "Daily Room", "Dehumidifier"].forEach(function(category) {
            categories.appendChild(makeButton(category, function() {
              showView("adminAreaView");
              const areaTitle = byId("adminAreaTitle");
              if (areaTitle) areaTitle.innerText = category;
            }, "yellow"));
          });
        }
      }, "yellow"));
    });
  };

  window.exitScheduleEditorToAdmin = window.exitScheduleEditorToAdmin || window.backToAdminCategories;
  window.backToScheduleEditorList = window.backToScheduleEditorList || window.openScheduleEditorFromAdmin;

  window.openRoomSafeCheck = window.openRoomSafeCheck || function() { showView("adminRoomSafeCheckView"); };
  window.openMaintenanceDashboard = window.openMaintenanceDashboard || function() { showView("adminMaintenanceDashboardView"); };
  window.openMaintenanceInspection = window.openMaintenanceInspection || function() { showView("adminMaintenanceInspectionView"); };
  window.openPtacDashboard = window.openPtacDashboard || function() { showView("adminPtacDashboardView"); };
  window.openIssues = window.openIssues || function() { showView("adminIssuesView"); };
  window.openDailyStatus = window.openDailyStatus || function() { showView("adminDailyStatusView"); };
  window.openIssueReasons = window.openIssueReasons || function() { showView("adminIssueReasonsView"); };

  function readFirestoreValue(value) {
    if (!value) return "";
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) return value.stringValue;
    if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) return value.booleanValue;
    if (Object.prototype.hasOwnProperty.call(value, "integerValue")) return Number(value.integerValue);
    if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) return Number(value.doubleValue);
    return "";
  }

  function normalizeArea(doc) {
    const fields = doc && doc.fields ? doc.fields : {};
    const item = { id: String(doc && doc.name ? doc.name : "").split("/").pop() };
    Object.keys(fields).forEach(function(key) {
      item[key] = readFirestoreValue(fields[key]);
    });
    item.areaName = item.areaName || item.area || item.name || "";
    item.category = item.category || "";
    item.schedule = item.schedule || item.assignment || item.assignedTo || "";
    item.floor = item.floor || item.floorName || item.floorNumber || "";
    return item;
  }

  function getFloorFromText(value) {
    const text = String(value || "").toLowerCase();
    if (/^1|1st|first/.test(text)) return "1";
    if (/^2|2nd|second/.test(text)) return "2";
    if (/^3|3rd|third/.test(text)) return "3";
    return "";
  }

  function getAreaFloor(area) {
    const room = String(area.areaName || "").replace(/\D/g, "").slice(0, 1);
    if (["1", "2", "3"].includes(room)) return room;
    return getFloorFromText(area.floor) || getFloorFromText(area.schedule);
  }

  function isCommonArea(area) {
    const name = String(area.areaName || "").trim();
    const category = String(area.category || "").toLowerCase();
    if (!name) return false;
    if (/^\d{3,4}$/.test(name)) return false;
    if (category && category !== "common area" && category !== "common areas") return false;
    return true;
  }

  async function loadFallbackAreas() {
    if (fallbackAreasLoaded) return;
    try {
      const response = await fetch(AREAS_REST_URL + "?pageSize=500&key=" + encodeURIComponent(FIRESTORE_REST_API_KEY), { cache: "no-store" });
      if (!response.ok) throw new Error("Could not load areas");
      const data = await response.json();
      fallbackAreas = (data.documents || []).map(normalizeArea);
      fallbackAreasLoaded = true;
    } catch (error) {
      fallbackAreas = [];
      fallbackAreasLoaded = true;
    }
  }

  function updateQuickToolButtons() {
    setActive("quickToolsRoomsButton", quickToolsMode === "rooms");
    setActive("quickToolsAreasButton", quickToolsMode === "commonAreas");
    setActive("quickToolsFloor1Button", quickToolsFloor === "1");
    setActive("quickToolsFloor2Button", quickToolsFloor === "2");
    setActive("quickToolsFloor3Button", quickToolsFloor === "3");
    const roomBox = byId("quickToolsRoomSearchBox");
    const areaBox = byId("quickToolsAreaSearchBox");
    if (roomBox) roomBox.classList.toggle("hidden", quickToolsMode !== "rooms");
    if (areaBox) areaBox.classList.toggle("hidden", quickToolsMode !== "commonAreas");
  }

  function openDoorDetails(info) {
    sessionStorage.setItem("mainDoorSelectedType", info.type);
    sessionStorage.setItem("mainDoorSelectedRoom", info.room || "");
    sessionStorage.setItem("mainDoorSelectedAreaName", info.areaName || "");
    sessionStorage.setItem("mainDoorSelectedAreaId", info.areaId || "");
    const title = byId("mainDoorDetailsTitle");
    const meta = byId("mainDoorDetailsMeta");
    const tools = byId("mainDoorDetailsTools");
    if (title) title.innerText = info.type === "room" ? "Room " + info.room : info.areaName;
    if (meta) meta.innerText = "Type: " + (info.type === "room" ? "Room" : "Common Area") + " | Floor: " + quickToolsFloor;
    if (tools) tools.classList.remove("hidden");
    showView("mainDoorDetailsView");
  }

  function drawRoomButtons() {
    const box = byId("quickToolsRoomButtons");
    if (!box) return;
    box.innerHTML = "";
    const input = byId("quickToolsRoomSearchInput");
    const raw = input ? String(input.value || "").replace(/\D/g, "").slice(0, 3) : "";
    if (input && input.value !== raw) input.value = raw;
    if (raw.length === 3) {
      box.appendChild(makeButton("Room " + raw, function() {
        openDoorDetails({ type: "room", room: raw });
      }, "yellow"));
    }
  }

  async function drawCommonAreaButtons() {
    const box = byId("quickToolsAreaButtons");
    if (!box) return;
    box.innerHTML = "";
    box.appendChild(makeButton("Loading common areas...", function() {}, "back"));
    await loadFallbackAreas();
    box.innerHTML = "";
    const areas = fallbackAreas.filter(isCommonArea).filter(function(area) {
      return getAreaFloor(area) === quickToolsFloor;
    });
    if (areas.length === 0) {
      box.appendChild(makeButton("No common areas found", function() {}, "back"));
      return;
    }
    areas.sort(function(a, b) { return String(a.areaName).localeCompare(String(b.areaName)); });
    areas.forEach(function(area) {
      box.appendChild(makeButton(area.areaName, function() {
        openDoorDetails({ type: "commonArea", areaName: area.areaName, areaId: area.id });
      }, "yellow"));
    });
  }

  window.openQuickToolsView = window.openQuickToolsView || function() {
    showView("adminQuickToolsView");
    updateQuickToolButtons();
    drawRoomButtons();
    drawCommonAreaButtons();
  };

  window.setQuickToolsMode = window.setQuickToolsMode || function(mode) {
    quickToolsMode = mode;
    updateQuickToolButtons();
    drawRoomButtons();
    drawCommonAreaButtons();
  };

  window.setQuickToolsFloor = window.setQuickToolsFloor || function(floor) {
    quickToolsFloor = String(floor || "1");
    updateQuickToolButtons();
    drawCommonAreaButtons();
  };

  window.handleQuickToolsRoomSearch = window.handleQuickToolsRoomSearch || drawRoomButtons;
  window.backToMainDoorFromDoorDetails = window.backToMainDoorFromDoorDetails || window.openQuickToolsView;
  window.openQuickToolsMaintenance = window.openQuickToolsMaintenance || function() { showView("adminMaintenanceInspectionView"); };
  window.openQuickToolsRoomReport = window.openQuickToolsRoomReport || function() { showView("adminRoomReportView"); };
  window.openQuickToolsDailyReport = window.openQuickToolsDailyReport || function() { showView("adminDailyReportView"); };
  window.openQuickToolsPtac = window.openQuickToolsPtac || function() { showView("adminPtacDashboardView"); };

  window.showAppMessage = window.showAppMessage || function(message, title) {
    const box = byId("appMessageBox");
    const titleBox = byId("appMessageTitle");
    const textBox = byId("appMessageText");
    if (titleBox) titleBox.innerText = title || "Message";
    if (textBox) textBox.innerText = message || "";
    if (box) box.classList.remove("hidden");
  };

  window.confirmAppMessage = window.confirmAppMessage || function() {
    const box = byId("appMessageBox");
    if (box) box.classList.add("hidden");
  };

  window.cancelAppMessage = window.cancelAppMessage || window.confirmAppMessage;

  document.addEventListener("DOMContentLoaded", function() {
    updateVersionLabels();
    drawAdminTopButtons();
  });

  setTimeout(function() {
    updateVersionLabels();
    drawAdminTopButtons();
  }, 300);
})();

/* =========================
   43D - MAIN DOOR HOUSEKEEPING DETAILS
========================== */

(function patchMainDoorHousekeepingDetails() {
  const PATCH_VERSION = "Updated: 2026-05-22 10:21 PM | admin.js";
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
