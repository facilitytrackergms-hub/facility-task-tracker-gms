/* =========================
   01 - ADMIN.JS SAFE LOCAL BUILD
========================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBgq_ooBeEN4noEyIxYPLVokgM6RjCO648",
  authDomain: "gms-task-tracker.firebaseapp.com",
  projectId: "gms-task-tracker",
  storageBucket: "gms-task-tracker.firebasestorage.app",
  messagingSenderId: "790880979860",
  appId: "1:790880979860:web:6faee2a6e56955af3c1d81",
  measurementId: "G-5TRHQMS039"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ADMIN_VERSION_LABEL = "Updated: 2026-05-22 11:32 PM | admin.js";

/* =========================
   02 - LOCAL DATA
========================== */

const ADMIN_SCHEDULES = ["HK1", "HK2", "1stfloor", "2ndFloor", "3rdFloor", "Laundry"];
let ADMIN_FLOORS = { "1": [], "2": [], "3": [] };
let ADMIN_COMMON_AREAS = { "1": [], "2": [], "3": [] };
let adminDoorDataLoaded = false;
let adminDoorDataLoading = null;

let adminCurrentSchedule = "";
let adminCurrentCategory = "";
let quickToolsMode = "rooms";
let quickToolsFloor = "1";
let quickToolsSelected = null;
let appConfirmCallback = null;
let appCancelCallback = null;

/* =========================
   03 - BASIC HELPERS
========================== */

function byId(id) {
  return document.getElementById(id);
}

function showOnly(viewId) {
  document.querySelectorAll(".card > div[id]").forEach(function(view) {
    view.classList.add("hidden");
  });
  const view = byId(viewId);
  if (view) view.classList.remove("hidden");
}

function setText(id, text) {
  const el = byId(id);
  if (el) el.innerText = text;
}

function setValue(id, value) {
  const el = byId(id);
  if (el) el.value = value;
}

function clearBox(id) {
  const el = byId(id);
  if (el) el.innerHTML = "";
}

function makeButton(text, className, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.innerText = text;
  if (className) btn.className = className;
  btn.onclick = onClick;
  return btn;
}

function setActiveButton(id, active) {
  const btn = byId(id);
  if (btn) btn.classList.toggle("active-quick-floor", !!active);
}

function limitRoomInput(input) {
  if (!input) return;
  input.value = String(input.value || "").replace(/\D/g, "").slice(0, 3);
}

function openAdminDashboard() {
  showOnly("adminView2");
  drawAdminTopButtons();
}

/* =========================
   04 - CUSTOM POPUP
========================== */

function showAppMessage(message, title, onConfirm, onCancel) {
  const popup = byId("appMessagePopup");
  setText("appMessageTitle", title || "Admin");
  setText("appMessageText", message || "");
  appConfirmCallback = typeof onConfirm === "function" ? onConfirm : null;
  appCancelCallback = typeof onCancel === "function" ? onCancel : null;
  if (popup) popup.classList.remove("hidden");
}

function confirmAppMessage() {
  const popup = byId("appMessagePopup");
  if (popup) popup.classList.add("hidden");
  const cb = appConfirmCallback;
  appConfirmCallback = null;
  appCancelCallback = null;
  if (cb) cb();
}

function cancelAppMessage() {
  const popup = byId("appMessagePopup");
  if (popup) popup.classList.add("hidden");
  const cb = appCancelCallback;
  appConfirmCallback = null;
  appCancelCallback = null;
  if (cb) cb();
}

/* =========================
   05 - ADMIN DASHBOARD BUTTONS
========================== */

function drawAdminTopButtons() {
  const box = byId("adminTopButtons");
  if (!box) return;
  box.innerHTML = "";
  const buttons = [
    ["1. Schedule Editor", "yellow", openScheduleEditor],
    ["2. Main Door", "yellow", openQuickToolsMainDoor],
    ["3. Room Safe Check", "yellow", openRoomSafeCheck],
    ["4. Issues", "yellow", loadAllIssues],
    ["5. Maintenance", "yellow", openMaintenanceDashboard],
    ["6. PTAC", "yellow", openPtacDashboard],
    ["7. Water Temp", "yellow", openWaterTemperatureView],
    ["8. Employee View", "yellow", openEmployeeAccessDashboard]
  ];
  buttons.forEach(function(item) {
    box.appendChild(makeButton(item[0], item[1], item[2]));
  });
}

function setHousekeepingMode(mode) {
  localStorage.setItem("adminHousekeepingMode", mode);
  const two = mode === "two";
  setActiveButton("modeTwoButton", two);
  setActiveButton("modeThreeButton", !two);
  showAppMessage(two ? "Mode 2 selected." : "Mode 3 selected.", "Schedule Mode");
}

function openReportChooser() {
  showAppMessage("Choose Room Report or Daily Report from Main Door after selecting a room or common area.", "Room / Area Report");
}

function openEmployees() { showOnly("employeeAccessDashboardView"); }
function openEmployeeAccessDashboard() { showOnly("employeeAccessDashboardView"); }
function logout() { openAdminDashboard(); }

/* =========================
   06 - SCHEDULE EDITOR
========================== */

function openScheduleEditor() {
  showOnly("adminScheduleEditorView");
  const box = byId("adminAssignmentButtons");
  if (!box) return;
  box.innerHTML = "";
  ADMIN_SCHEDULES.forEach(function(name) {
    box.appendChild(makeButton(name, "yellow", function() {
      adminCurrentSchedule = name;
      openScheduleChoice(name);
    }));
  });
}

function exitScheduleEditorToAdmin() { openAdminDashboard(); }
function changeAdminAssignment() {
  const sel = byId("adminAssignmentSelect");
  if (sel && sel.value) openScheduleChoice(sel.value);
}
function openScheduleChoice(name) {
  adminCurrentSchedule = name;
  showOnly("adminScheduleChoiceView");
  setText("adminScheduleChoiceTitle", name + " Editor");
  const box = byId("adminCategoryButtons");
  if (!box) return;
  box.innerHTML = "";
  box.appendChild(makeButton("ROOMS", "yellow", function() { openAdminAreaList(name, "rooms"); }));
  box.appendChild(makeButton("COMMON AREAS", "yellow", function() { openAdminAreaList(name, "commonAreas"); }));
  box.appendChild(makeButton("DAILY ROOMS", "yellow", function() { openAdminAreaList(name, "dailyRooms"); }));
  box.appendChild(makeButton("TASKS", "yellow", openAdminAreaTasks));
}
function backToScheduleEditorList() { openScheduleEditor(); }

/* =========================
   07 - AREA LIST AND EDIT
========================== */

async function openAdminAreaList(schedule, category) {
  adminCurrentSchedule = schedule || adminCurrentSchedule || "HK1";
  adminCurrentCategory = category || "rooms";
  showOnly("adminAreaView");
  setText("adminAreaAssignmentTitle", adminCurrentSchedule);
  setText("adminAreaModeLabel", adminCurrentCategory === "commonAreas" ? "Common Areas" : "Rooms");
  setText("adminAreaTitle", adminCurrentCategory === "commonAreas" ? "Common Areas" : "Rooms");
  const box = byId("adminAreaButtons");
  if (box) box.innerHTML = "Loading database rooms...";
  await loadMainDoorDataFromDatabase(false);
  drawAdminAreaButtons();
}

function drawAdminAreaButtons() {
  const box = byId("adminAreaButtons");
  if (!box) return;
  box.innerHTML = "";
  let items = [];
  if (adminCurrentCategory === "commonAreas") {
    items = Object.values(ADMIN_COMMON_AREAS).flat();
  } else {
    items = Object.values(ADMIN_FLOORS).flat();
  }
  const search = (byId("adminAreaSearchInput")?.value || "").toLowerCase();
  items.filter(function(item) { return !search || String(item).toLowerCase().includes(search); }).forEach(function(item) {
    box.appendChild(makeButton(String(item), "", function() { openAdminEditItem(item); }));
  });
}

function searchAdminAreas() { drawAdminAreaButtons(); }
function openAdminEditItem(name) {
  showOnly("adminEditView");
  setText("adminEditTitle", "Edit " + name);
  setValue("adminEditAreaInput", name);
  setValue("adminEditAssignmentInput", adminCurrentSchedule || "HK1");
}
function openNewAdminArea() { openAdminEditItem(""); }
function saveAdminAreaOnly() { showAppMessage("Saved locally in this safe admin build.", "Save"); }
function deleteAdminArea() { showAppMessage("Delete is disabled in this safe local build.", "Delete"); }
function backToAdminAreas() { openAdminAreaList(adminCurrentSchedule, adminCurrentCategory); }
function backToAdminAreaEdit() { showOnly("adminEditView"); }
function backToAdminCategories() { openAdminDashboard(); }
function changeAdminAreaScheduleDay() {}
function setAdminAreaWeekday(day) { localStorage.setItem("adminAreaWeekday", day); }

/* =========================
   07A - DATABASE DOOR DATA
========================== */

function normalizeDoorFloor(value, fallbackName) {
  const text = String(value || fallbackName || "").trim().toLowerCase();
  const numberText = String(fallbackName || value || "").match(/\d+/);

  if (text.includes("1st") || text.includes("first") || text === "1" || text === "1stfloor") return "1";
  if (text.includes("2nd") || text.includes("second") || text === "2" || text === "2ndfloor") return "2";
  if (text.includes("3rd") || text.includes("third") || text === "3" || text === "3rdfloor") return "3";

  if (numberText) {
    const firstDigit = numberText[0].charAt(0);
    if (["1", "2", "3"].includes(firstDigit)) return firstDigit;
  }

  return "1";
}

function getDatabaseRoomNumber(area) {
  const roomSource = area.roomKey || area.roomNumber || area.roomName || area.areaName || area.name || "";
  const match = String(roomSource).match(/\d+/);
  return match ? match[0] : "";
}

function getDatabaseAreaName(area, fallbackId) {
  return String(area.areaName || area.name || area.label || area.title || fallbackId || "").trim();
}

function addUniqueDoorValue(list, value) {
  const text = String(value || "").trim();
  if (!text) return;

  const exists = list.some(function(item) {
    return String(item || "").trim().toLowerCase() === text.toLowerCase();
  });

  if (!exists) list.push(text);
}

function sortDoorValues(list) {
  return list.slice().sort(function(a, b) {
    return String(a || "").localeCompare(String(b || ""), undefined, {
      numeric: true,
      sensitivity: "base"
    });
  });
}

async function loadMainDoorDataFromDatabase(forceRefresh) {
  if (adminDoorDataLoaded && !forceRefresh) return;
  if (adminDoorDataLoading) return adminDoorDataLoading;

  adminDoorDataLoading = (async function() {
    const floors = { "1": [], "2": [], "3": [] };
    const commonAreas = { "1": [], "2": [], "3": [] };

    try {
      const snap = await getDocs(collection(db, "areas"));

      snap.docs.forEach(function(docSnap) {
        const area = { id: docSnap.id, ...docSnap.data() };
        if (area.active === false) return;

        const areaName = getDatabaseAreaName(area, docSnap.id);
        const roomNumber = getDatabaseRoomNumber(area);
        const categoryText = String(area.category || area.categoryKey || "").trim().toLowerCase();
        const floor = normalizeDoorFloor(area.floor || area.floorNumber || area.schedule || area.sourceSheet || "", areaName || roomNumber);

        if (categoryText.includes("common") || (!roomNumber && areaName)) {
          addUniqueDoorValue(commonAreas[floor], areaName);
          return;
        }

        if (roomNumber) {
          addUniqueDoorValue(floors[floor], roomNumber);
        }
      });

      ADMIN_FLOORS = {
        "1": sortDoorValues(floors["1"]),
        "2": sortDoorValues(floors["2"]),
        "3": sortDoorValues(floors["3"])
      };

      ADMIN_COMMON_AREAS = {
        "1": sortDoorValues(commonAreas["1"]),
        "2": sortDoorValues(commonAreas["2"]),
        "3": sortDoorValues(commonAreas["3"])
      };

      adminDoorDataLoaded = true;
    } catch (error) {
      console.error("Could not load Main Door data from Firestore", error);
      showAppMessage("Could not load rooms and common areas from the database.", "Main Door");
    } finally {
      adminDoorDataLoading = null;
    }
  })();

  return adminDoorDataLoading;
}

/* =========================
   08 - MAIN DOOR
========================== */

async function openQuickToolsMainDoor() {
  showOnly("adminQuickToolsView");
  const roomBox = byId("quickToolsRoomButtons");
  const areaBox = byId("quickToolsAreaButtons");
  if (roomBox) roomBox.innerHTML = "Loading database rooms...";
  if (areaBox) areaBox.innerHTML = "";
  await loadMainDoorDataFromDatabase(false);
  drawQuickTools();
}

function setQuickToolsMode(mode) {
  quickToolsMode = mode;
  quickToolsSelected = null;
  drawQuickTools();
}

function setQuickToolsFloor(floor) {
  quickToolsFloor = String(floor || "1");
  quickToolsSelected = null;
  drawQuickTools();
}

function handleQuickToolsRoomSearch() { drawQuickTools(); }

function drawQuickTools() {
  setActiveButton("quickToolsRoomsButton", quickToolsMode === "rooms");
  setActiveButton("quickToolsAreasButton", quickToolsMode === "commonAreas");
  setActiveButton("quickToolsFloor1Button", quickToolsFloor === "1");
  setActiveButton("quickToolsFloor2Button", quickToolsFloor === "2");
  setActiveButton("quickToolsFloor3Button", quickToolsFloor === "3");

  byId("quickToolsRoomSearchBox")?.classList.toggle("hidden", quickToolsMode !== "rooms");
  byId("quickToolsAreaSearchBox")?.classList.toggle("hidden", quickToolsMode !== "commonAreas");
  drawQuickToolRooms();
  drawQuickToolAreas();
  drawQuickToolsSelected();
}

function drawQuickToolRooms() {
  const box = byId("quickToolsRoomButtons");
  if (!box) return;
  box.innerHTML = "";
  if (quickToolsMode !== "rooms") return;
  const search = String(byId("quickToolsRoomSearchInput")?.value || "").trim();
  const rooms = ADMIN_FLOORS[quickToolsFloor] || [];
  const filteredRooms = rooms.filter(function(room) { return !search || String(room).includes(search); });

  if (filteredRooms.length === 0) {
    box.innerHTML = "<div class='admin-safe-note'>No database rooms found for this floor.</div>";
    return;
  }

  filteredRooms.forEach(function(room) {
    box.appendChild(makeButton("Room " + room, "", function() {
      quickToolsSelected = { type: "room", name: "Room " + room, key: room };
      sessionStorage.setItem("mainDoorSelectedType", "room");
      sessionStorage.setItem("mainDoorSelectedRoom", room);
      drawQuickToolsSelected();
    }));
  });
}

function drawQuickToolAreas() {
  const box = byId("quickToolsAreaButtons");
  if (!box) return;
  box.innerHTML = "";
  if (quickToolsMode !== "commonAreas") return;
  const areaSearch = String(byId("quickToolsAreaSearchInput")?.value || "").trim().toLowerCase();
  const areas = ADMIN_COMMON_AREAS[quickToolsFloor] || [];
  const filteredAreas = areas.filter(function(area) {
    return !areaSearch || String(area || "").toLowerCase().includes(areaSearch);
  });

  if (filteredAreas.length === 0) {
    box.innerHTML = "<div class='admin-safe-note'>No database common areas found for this floor.</div>";
    return;
  }

  filteredAreas.forEach(function(area) {
    box.appendChild(makeButton(area, "", function() {
      quickToolsSelected = { type: "commonArea", name: area, key: area.toLowerCase().replace(/[^a-z0-9]+/g, "_") };
      sessionStorage.setItem("mainDoorSelectedType", "commonArea");
      sessionStorage.setItem("mainDoorSelectedAreaName", area);
      drawQuickToolsSelected();
    }));
  });
}

function drawQuickToolsSelected() {
  const label = byId("quickToolsSelectedLabel");
  const actions = byId("quickToolsActionButtons");
  if (!label || !actions) return;

  if (!quickToolsSelected) {
    label.classList.add("hidden");
    actions.classList.add("hidden");
    label.innerHTML = "";
    return;
  }

  label.classList.remove("hidden");
  actions.classList.remove("hidden");
  label.innerHTML = "Selected: " + quickToolsSelected.name + "<br><span class='admin-safe-note'>Use the yellow tools for this door.</span>";

  const ptac = byId("quickToolsPtacButton");
  if (ptac) ptac.classList.toggle("hidden", quickToolsSelected.type !== "room");
}

function openQuickToolsMaintenance() { openMaintenanceInspection(); }
function openQuickToolsRoomReport() { showAppMessage("Room Report opened for " + (quickToolsSelected?.name || "selected door") + ".", "Room Report"); }
function openQuickToolsDailyReport() { showAppMessage("Daily Report opened for " + (quickToolsSelected?.name || "selected door") + ".", "Daily Report"); }
function openQuickToolsPtac() { openPtacDashboard(); }

/* =========================
   09 - WATER TEMP / ROOM SAFE / ISSUES
========================== */

function openWaterTemperatureView() {
  showOnly("waterTemperatureView");
  drawWaterTemperatureGrid();
}
function drawWaterTemperatureGrid() {
  const box = byId("waterTemperatureGrid");
  if (!box) return;
  box.innerHTML = "";
  Object.values(ADMIN_FLOORS).flat().slice(0, 18).forEach(function(room) {
    box.appendChild(makeButton(room, "", function() { showAppMessage("Water temperature marked for Room " + room + ".", "Water Temp"); }));
  });
}
function setWaterTemperatureFloorFilter(floor) { quickToolsFloor = String(floor); drawWaterTemperatureGrid(); }
function toggleWaterTemperatureSummary() { byId("waterTemperatureUsedLabel")?.classList.toggle("hidden"); }

function openRoomSafeCheck() {
  showOnly("roomSafeCheckView");
  drawRoomSafeCheck();
}
function drawRoomSafeCheck() {
  const all = byId("roomSafeAllList");
  const found = byId("roomSafeFoundList");
  const missing = byId("roomSafeMissingList");
  if (all) all.innerHTML = Object.values(ADMIN_FLOORS).flat().map(r => "<button type='button'>" + r + "</button>").join("");
  if (found) found.innerHTML = "";
  if (missing) missing.innerHTML = "";
}
function openRoomSafeAddRoom() { byId("roomSafeAddBox")?.classList.remove("hidden"); }
function cancelRoomSafeAddRoom() { byId("roomSafeAddBox")?.classList.add("hidden"); }
function saveRoomSafeAddedRoom() { cancelRoomSafeAddRoom(); showAppMessage("Room added locally.", "Room Safe"); }
function changeRoomSafeDayFilter() {}
function changeRoomSafeTypeFilter() {}
function clearRoomSafeFilters() { setValue("roomSafeDayFilter", "All"); }

function loadAllIssues() { showOnly("adminIssueReasonsView"); drawIssueReasonList(); }
function loadFilteredIssues() { loadAllIssues(); }
function drawIssueList() { loadAllIssues(); }
function addIssueReason() { showAppMessage("Issue reason added locally.", "Issues"); }
function drawIssueReasonList() {
  const box = byId("issueReasonList");
  if (box) box.innerHTML = "<div class='admin-safe-note'>No saved issue reasons loaded in this safe local build.</div>";
}

/* =========================
   10 - MAINTENANCE / PTAC / LAUNDRY PLACEHOLDERS
========================== */

function openMaintenanceDashboard() { showOnly("adminMaintenanceInspectionView"); }
function openMaintenanceInspection() { showOnly("adminMaintenanceInspectionView"); }
function openMaintenanceInspectionReport() { showAppMessage("Maintenance report view is ready for connection.", "Maintenance"); }
function openMaintenanceWorkBoard() { showAppMessage("Maintenance work board is ready for connection.", "Maintenance"); }
function openMaintenanceMaterialsNeeded() { showAppMessage("Materials needed view is ready for connection.", "Maintenance"); }
function openMaintenanceInspectionStartPopup() { byId("maintenanceStartPopup")?.classList.remove("hidden"); }
function cancelMaintenanceInspectionStartPopup() { byId("maintenanceStartPopup")?.classList.add("hidden"); }
function confirmMaintenanceInspectionStartPopup() { cancelMaintenanceInspectionStartPopup(); showAppMessage("Inspection started.", "Maintenance"); }
function chooseMaintenanceInspectionSearchType(type) { byId("maintenanceStartInputBox")?.classList.remove("hidden"); }
function handleMaintenanceStartInput() {}
function handleMaintenanceInspectionSearchInput() {}
function handleMaintenanceInspectionReportInput() {}
function refreshMaintenanceInspectionReport() {}
function openMaintenanceInspectionResultPopup() { byId("maintenanceResultPopup")?.classList.remove("hidden"); }
function closeMaintenanceInspectionResultPopup() { byId("maintenanceResultPopup")?.classList.add("hidden"); }
function chooseMaintenanceInspectionResult(result) { closeMaintenanceInspectionResultPopup(); showAppMessage("Inspection marked " + result + ".", "Maintenance"); }
function selectMaintenanceResidentStatus(status) { showAppMessage("Resident status: " + status, "Maintenance"); }
function selectMaintenanceUrgency(level) { ["Low","Med","High"].forEach(l => setActiveButton("maintenanceUrgency" + l + "Btn", l === level)); }
function changeMaintenanceInspectionItem() {}
function openMaintenanceNewItemPopup() { showAppMessage("Add item popup placeholder.", "Maintenance"); }
function deleteSelectedMaintenanceInspectionItem() { showAppMessage("Delete item disabled in safe build.", "Maintenance"); }
function openMaintenanceNewReasonPopup() { showAppMessage("Add reason popup placeholder.", "Maintenance"); }
function deleteSelectedMaintenanceInspectionReason() { showAppMessage("Delete reason disabled in safe build.", "Maintenance"); }
function selectMaintenanceInspectionReason(value) {}
function openMaintenanceMaterialsPopup() { showAppMessage("Materials popup placeholder.", "Maintenance"); }
function selectMaintenanceInspectionMaterial(value) {}
function openMaintenanceManualMaterialPopup() { byId("maintenanceManualMaterialPopup")?.classList.remove("hidden"); }
function cancelMaintenanceManualMaterialPopup() { byId("maintenanceManualMaterialPopup")?.classList.add("hidden"); }
function confirmMaintenanceManualMaterialPopup() { cancelMaintenanceManualMaterialPopup(); showAppMessage("Material saved locally.", "Maintenance"); }
function selectMaintenanceManualMaterialLocation(location) {}
function deleteSelectedMaintenanceInspectionMaterial() { showAppMessage("Delete material disabled in safe build.", "Maintenance"); }
function openMaintenanceTextPopup() { byId("maintenanceTextPopup")?.classList.remove("hidden"); }
function cancelMaintenanceTextPopup() { byId("maintenanceTextPopup")?.classList.add("hidden"); }
function confirmMaintenanceTextPopup() { cancelMaintenanceTextPopup(); showAppMessage("Saved.", "Maintenance"); }

function openPtacDashboard() { showOnly("adminPtacView"); }
function openPtacFromEmployeeDashboard() { openPtacDashboard(); }
function openPtacFloor(floor) { showAppMessage("PTAC floor " + floor + " selected.", "PTAC"); }
function openPtacRoom(room) { showAppMessage("PTAC room opened.", "PTAC"); }
function openPtacRoomFromSearch() { showAppMessage("PTAC room opened from search.", "PTAC"); }
function handlePtacQuickSearch() {}
function openPtacHistory() { showAppMessage("PTAC history ready for connection.", "PTAC"); }
function openPtacNotes() { showAppMessage("PTAC notes ready for connection.", "PTAC"); }
function openPtacQueue(status) { showAppMessage("PTAC queue: " + status, "PTAC"); }
function savePtacStatus(status) { showAppMessage("PTAC status saved: " + status, "PTAC"); }
function confirmPtacReset() { showAppMessage("PTAC reset confirmed.", "PTAC"); }

function changeLaundryScheduleCategory() {}
function loadLaundryScheduleRooms() {}
function drawLaundryScheduleRooms() {}
function clearLaundryRoomSelection() {}
function selectAllLaundryRooms() {}
function saveLaundryScheduleChanges() { showAppMessage("Laundry schedule saved locally.", "Laundry"); }

/* =========================
   11 - TASKS / EMPLOYEES STUBS
========================== */

function openAdminAreaTasks() { showAppMessage("Task tools ready for connection.", "Tasks"); }
function searchAdminAreaTasks() {}
function openNewAdminSubTask() { showAppMessage("Add task placeholder.", "Tasks"); }
function saveAdminSubTask() { showAppMessage("Task saved locally.", "Tasks"); }
function saveAdminSubTaskToAllWeeklyRooms() { showAppMessage("Task saved to weekly rooms locally.", "Tasks"); }
function deleteAdminSubTask() { showAppMessage("Delete task disabled in safe build.", "Tasks"); }
function cancelAdminSubTaskEditor() { openAdminDashboard(); }
function toggleAdminBulkTaskBox() { byId("adminBulkTaskBox")?.classList.toggle("hidden"); }
function addCheckedTasksToAllAreas() { showAppMessage("Tasks added locally.", "Tasks"); }
function deleteCheckedTasksFromAllAreas() { showAppMessage("Tasks deleted locally.", "Tasks"); }
function addCheckedTasksToSingleArea() { showAppMessage("Task added locally.", "Tasks"); }
function deleteCheckedTasksFromSingleArea() { showAppMessage("Task deleted locally.", "Tasks"); }

function openNewEmployee() { showAppMessage("Add employee placeholder.", "Employees"); }
function saveEmployee() { showAppMessage("Employee saved locally.", "Employees"); }
function deleteEmployee() { showAppMessage("Delete employee disabled in safe build.", "Employees"); }
function applyEmployeePermissionDefaultsFromInputs() {}
function checkAssignmentCounts() { showAppMessage("Schedule counts checked locally.", "Employees"); }
function openWeeklySchedulesFromEmployeeDashboard() { openScheduleEditor(); }

/* =========================
   12 - REPORT FLOW STUBS
========================== */

function changeRoomReportDate() {}
function changeDailyReportDate() {}
function changeDailyStatusDate() {}
function handleRoomReportSearchKey(event) {}
function handleDailyReportSearchKey(event) {}
function handleReportRoomAutoInput(input, type) {}
function openDehumidifierReassignment() { showAppMessage("Dehumidifier reassignment ready for connection.", "Dehumidifier"); }
function backToReassignment() { openAdminDashboard(); }
function changeReassignmentCategory() {}
function changeReassignmentFrom() {}
function changeReassignmentTo() {}
function selectReassignmentArea(value) {}
function saveSelectedReassignmentArea() { showAppMessage("Reassignment saved locally.", "Dehumidifier"); }
function setReassignmentFromWeekday(day) {}
function setReassignmentToWeekday(day) {}

/* =========================
   13 - EXPORT FUNCTIONS FOR HTML ONCLICK
========================== */

Object.assign(window, {
  addCheckedTasksToAllAreas, addCheckedTasksToSingleArea, addIssueReason, applyEmployeePermissionDefaultsFromInputs,
  backToAdminAreaEdit, backToAdminAreas, backToAdminCategories, backToReassignment, backToScheduleEditorList,
  cancelAdminSubTaskEditor, cancelAppMessage, cancelMaintenanceInspectionStartPopup, cancelMaintenanceManualMaterialPopup,
  cancelMaintenanceTextPopup, cancelRoomSafeAddRoom, changeAdminAreaScheduleDay, changeAdminAssignment, changeDailyReportDate,
  changeDailyStatusDate, changeLaundryScheduleCategory, changeMaintenanceInspectionItem, changeReassignmentCategory,
  changeReassignmentFrom, changeReassignmentTo, changeRoomReportDate, changeRoomSafeDayFilter, changeRoomSafeTypeFilter,
  checkAssignmentCounts, chooseMaintenanceInspectionResult, chooseMaintenanceInspectionSearchType, clearLaundryRoomSelection,
  clearRoomSafeFilters, closeMaintenanceInspectionResultPopup, confirmAppMessage, confirmMaintenanceInspectionStartPopup,
  confirmMaintenanceManualMaterialPopup, confirmMaintenanceTextPopup, confirmPtacReset, deleteAdminArea, deleteAdminSubTask,
  deleteCheckedTasksFromAllAreas, deleteCheckedTasksFromSingleArea, deleteEmployee, deleteSelectedMaintenanceInspectionItem,
  deleteSelectedMaintenanceInspectionMaterial, deleteSelectedMaintenanceInspectionReason, drawDailyStatusList: function(){}, drawIssueList,
  drawIssueReasonList, drawLaundryScheduleRooms, drawRoomSafeCheck, exitScheduleEditorToAdmin, handleDailyReportSearchKey,
  handleMaintenanceInspectionReportInput, handleMaintenanceInspectionSearchInput, handleMaintenanceStartInput, handlePtacQuickSearch,
  handleQuickToolsRoomSearch, handleReportRoomAutoInput, handleRoomReportSearchKey, limitRoomInput, loadAllIssues, loadFilteredIssues,
  loadLaundryScheduleRooms, logout, openAdminAreaTasks, openDehumidifierReassignment, openEmployeeAccessDashboard, openEmployees,
  openMaintenanceDashboard, openMaintenanceInspection, openMaintenanceInspectionReport, openMaintenanceInspectionResultPopup,
  openMaintenanceInspectionStartPopup, openMaintenanceManualMaterialPopup, openMaintenanceMaterialsNeeded, openMaintenanceMaterialsPopup,
  openMaintenanceNewItemPopup, openMaintenanceNewReasonPopup, openMaintenanceWorkBoard, openNewAdminArea, openNewAdminSubTask,
  openNewEmployee, openPtacDashboard, openPtacFloor, openPtacFromEmployeeDashboard, openPtacHistory, openPtacNotes, openPtacQueue,
  openPtacRoom, openPtacRoomFromSearch, openQuickToolsDailyReport, openQuickToolsMaintenance, openQuickToolsPtac,
  openQuickToolsRoomReport, openReportChooser, openRoomSafeAddRoom, openRoomSafeCheck, openWaterTemperatureView,
  openWeeklySchedulesFromEmployeeDashboard, refreshMaintenanceInspectionReport, saveAdminAreaOnly, saveAdminSubTask,
  saveAdminSubTaskToAllWeeklyRooms, saveEmployee, saveLaundryScheduleChanges, savePtacStatus, saveRoomSafeAddedRoom,
  saveSelectedReassignmentArea, searchAdminAreaTasks, searchAdminAreas, selectAllLaundryRooms, selectMaintenanceInspectionMaterial,
  selectMaintenanceInspectionReason, selectMaintenanceManualMaterialLocation, selectMaintenanceResidentStatus, selectMaintenanceUrgency,
  selectReassignmentArea, setAdminAreaWeekday, setHousekeepingMode, setQuickToolsFloor, setQuickToolsMode, setReassignmentFromWeekday,
  setReassignmentToWeekday, setWaterTemperatureFloorFilter, showAppMessage, toggleAdminBulkTaskBox, toggleWaterTemperatureSummary
});

/* =========================
   14 - STARTUP
========================== */

document.addEventListener("DOMContentLoaded", function() {
  document.querySelectorAll(".app-version-label").forEach(function(el) {
    if (el.innerText.includes("admin.html")) el.innerText = "Updated: 2026-05-22 11:32 PM | admin.html";
  });
  const mode = localStorage.getItem("adminHousekeepingMode") || "two";
  setActiveButton("modeTwoButton", mode === "two");
  setActiveButton("modeThreeButton", mode === "three");
  drawAdminTopButtons();
});
