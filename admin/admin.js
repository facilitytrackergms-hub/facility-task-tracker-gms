
/* =========================
     11 - FIREBASE IMPORTS
  ========================== */

  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

  import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    arrayRemove,
    writeBatch
  } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

  /* =========================
     12 - FIREBASE CONFIG
  ========================== */

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

  /* =========================
     13 - SESSION DATA
  ========================== */

  const sessionData = JSON.parse(sessionStorage.getItem("currentEmployee"));
  const isAdminUserRole = String((sessionData && sessionData.role) || "").trim().toLowerCase() === "admin";

  if (!sessionData) {
    window.location.href = "index.html";
  }

  /* =========================
     13B - ADMIN PERMISSIONS
  ========================== */

  function hasPermission(permissionName) {
    if (!sessionData) return false;

    if (String(sessionData.role || "").toLowerCase() === "admin") {
      return true;
    }

    const permissions = sessionData.permissions || {};
    const value = permissions[permissionName];

    if (value === true) return true;
    if (value === false) return false;

    const text = String(value || "").trim().toLowerCase();

    return text === "yes" || text === "true" || text === "1";
  }

  function requirePermission(permissionName) {
    if (hasPermission(permissionName)) return true;

    showAppMessage("Access not allowed.");
    return false;
  }


  function getScheduleReturnTicket() {
    try {
      const text = sessionStorage.getItem("scheduleReturnTicket") || "";
      if (!text) return null;
      const ticket = JSON.parse(text);
      return ticket && ticket.returnToSchedule === true ? ticket : null;
    } catch (error) {
      return null;
    }
  }

  function hasScheduleReturnTicket() {
    return !!getScheduleReturnTicket();
  }

  function returnToScheduleIfNeeded() {
    if (!hasScheduleReturnTicket()) return false;
    window.location.href = "schedule.html";
    return true;
  }

  function setPermissionElementVisibility(id, canShow) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle("hidden", !canShow);
  }


  function hasQuickToolsPinAccess() {
    const pinValue = String(
      sessionData?.pin ||
      sessionData?.employeePin ||
      sessionData?.adminPin ||
      sessionData?.password ||
      sessionData?.loginPin ||
      ""
    ).trim();

    if (pinValue === "5555") return true;

    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || "";
        const value = String(sessionStorage.getItem(key) || "").trim();
        if (key.toLowerCase().includes("pin") || key.toLowerCase().includes("pass")) {
          if (value === "5555") return true;
        }
      }
    } catch (error) {
      return false;
    }

    return false;
  }

  function canOpenAdminDashboardItem(item) {
    if (item === "Logout") return true;
    if (item === "Luis Dashboard") return true;
    if (item === "Schedule Editor") return hasPermission("editSchedules");
    if (item === "Daily Status") return hasPermission("dailyStatus");
    if (item === "Rooms Assignments") return hasPermission("editSchedules") || hasPermission("reports") || hasPermission("adminDashboard");
    if (item === "Main Door") return true;
    if (item === "Room / Area Tools") return hasQuickToolsPinAccess();
    if (item === "Issues") return hasPermission("issues");
    if (item === "Issue Reasons") return hasPermission("editIssueReasons");
    if (item === "Maintenance Inspection") return hasPermission("maintenanceInspection") || hasPermission("maintenanceWorkBoard") || hasPermission("materialsNeeded");
    if (item === "PTAC") return hasPermission("ptac");
    if (["Dehumidifier", "Common Area", "Weekly Room", "Daily Room", "Weekly Laundry", "Daily Laundry"].includes(item)) return hasPermission("editSchedules");
    return true;
  }

  function applyAdminPermissionVisibility() {
    setPermissionElementVisibility("adminReportSectionTitle", hasPermission("reports"));
    setPermissionElementVisibility("adminReportSection", hasPermission("reports"));
    setPermissionElementVisibility("adminModeSectionTitle", hasPermission("changeScheduleMode"));
    setPermissionElementVisibility("adminModeSection", hasPermission("changeScheduleMode"));
    setPermissionElementVisibility("adminEmployeeSectionTitle", hasPermission("editEmployees"));
    setPermissionElementVisibility("adminEmployeeSection", hasPermission("editEmployees"));
    setPermissionElementVisibility("adminScheduleSectionTitle", hasPermission("editSchedules"));
    setPermissionElementVisibility("adminScheduleToolsTitle", hasPermission("editSchedules"));
    setPermissionElementVisibility("adminScheduleToolButtons", hasPermission("editSchedules"));
    setPermissionElementVisibility("adminCategorySectionTitle", hasPermission("editSchedules"));
    setPermissionElementVisibility("adminAssignmentButtons", hasPermission("editSchedules"));
    setPermissionElementVisibility("adminCategoryButtons", hasPermission("editSchedules"));
  }

  function applyMaintenanceDashboardPermissions() {
    setPermissionElementVisibility("maintenanceNewInspectionButton", hasPermission("maintenanceInspection"));
    setPermissionElementVisibility("maintenanceInspectionReportButton", hasPermission("maintenanceInspection"));
    setPermissionElementVisibility("maintenanceWorkBoardButton", hasPermission("maintenanceWorkBoard"));
    setPermissionElementVisibility("maintenanceMaterialsButton", hasPermission("materialsNeeded"));
  }

  /* =========================
     14 - GLOBAL ADMIN VARIABLES
  ========================== */

  let currentAssignment = "";
  let adminScheduleEditorFlowActive = false;
  const adminDefaultAssignment = sessionData.defaultSchedule || sessionData.assignment || "HK1";
  let currentWorkDateISO = getTodayISO();
  let currentWorkDayName = "";
  let adminAreaManualDayName = "";
  let reassignWorkDateISO = getTodayISO();
  let reassignWorkDayName = "";
  let reassignTargetDayName = "";
  let selectedReassignmentAreaId = "";
  let dehumidifierReassignStep = "";
  let dehumidifierFromAreaId = "";
  let appMessageInputCallback = null;
  let appMessageCancelCallback = null;
  let maintenancePopupSaveCallback = null;

  let housekeepingMode = "two";
  let selectedCategory = "";
  let selectedArea = "";
  let selectedAreaDocId = "";
  let selectedAreaWorkId = "";
  let selectedAreaScheduleDay = "";
  let adminAreaSaveRedirectedToExisting = false;
  let adminAreaOpenedFromDailyRoomAccess = false;
  let adminAreaSearchTerm = "";
  let adminAreaTaskSearchTerm = "";
  let adminBulkTaskOpen = false;

  let allAreas = [];
  let allAreasForAssignment = [];
  let allAreasForDay = [];
  let allSubTasks = [];
  let allIssues = [];
  let allIssueReasons = [];
  let allStatusRecords = [];
  let allMaintenanceInspectionItems = [];
  let allMaintenanceInspectionRecords = [];
  let allMaintenanceManualMaterials = [];
  let allPtacRecords = [];
  let allWaterTemperatureRecords = [];
  let waterTemperatureLocations = [];
  let waterTemperatureSummaryOnly = false;
  let waterTemperatureFloorFilter = "1";
  let currentPtacRoom = "";
  let currentPtacFloor = "";
  let currentPtacQueueStatus = "";
  let selectedMaintenanceInspectionArea = null;
  let selectedMaintenanceInspectionReason = "";
  let selectedMaintenanceResidentStatus = "Occupied";
  let selectedMaintenanceUrgency = "";
  let maintenanceStartSearchType = "room";
  let maintenanceManualMaterialLocationType = "general";
  let maintenanceReinspectIssueId = "";
  let maintenanceReinspectInspectionId = "";
  let maintenanceReportRefreshTimer = null;
  let roomSettingsData = {};
  let allRoomSettings = [];
  let currentAreaTasks = [];
  let currentEmployeeId = "";
  let currentEditingTaskId = "";
  let currentEditingTaskIndex = -1;
  let originalEditingTaskName = "";
  let laundryScheduleRooms = [];
  let currentRoomReportNumber = "";
  let currentRoomReportAreas = [];
  let currentRoomReportStatuses = [];
  let currentRoomReportIssues = [];
  let currentDailyReportIssueCategory = "";
  let pendingReportType = "";

  const DEFAULT_WEEKLY_ROOM_TASKS = ["Vac", "Fridge", "Bath", "Mop", "Toilet", "Sink", "Dust", "Bed", "AC Filter"];
  const DEFAULT_DAILY_ROOM_TASKS = ["Clean"];
  const REAL_ASSIGNMENTS = ["HK1", "HK2", "1stfloor", "2ndFloor", "3rdFloor", "Laundry"];
  const PTAC_ROOM_LIST = {
    1: ["102", "103", "104", "105", "106", "107", "108", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120"],
    2: ["201", "202", "203", "204", "205", "206", "207", "208", "211", "212", "213", "214", "215", "216", "217", "218", "219", "222", "223", "224", "225", "226", "227", "228", "229", "230"],
    3: ["301", "302", "303", "304", "305", "306", "307", "308", "311", "312", "313", "314", "315", "316", "317", "318", "319", "320", "321", "322", "324", "325", "326", "327", "328", "329", "330"]
  };

  currentAssignment = "";

  function getActiveAssignments() {
    if (housekeepingMode === "three") {
      return ["1stfloor", "2ndFloor", "3rdFloor", "Laundry"];
    }

    return ["HK1", "HK2", "Laundry"];
  }

  function updateAssignmentDropdownOptions(selectId, includeBlank, blankText) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const currentValue = select.value;
    const assignments = ["adminAssignmentSelect", "adminEditAssignmentInput"].includes(selectId)
      ? REAL_ASSIGNMENTS
      : getActiveAssignments();

    select.innerHTML = "";

    if (includeBlank) {
      const blank = document.createElement("option");
      blank.value = "";
      blank.innerText = blankText || "Select assignment";
      select.appendChild(blank);
    }

    assignments.forEach(function(assignment) {
      const option = document.createElement("option");
      option.value = assignment;
      option.innerText = assignment;
      select.appendChild(option);
    });

    if (assignments.includes(currentValue)) {
      select.value = currentValue;
    } else if (includeBlank) {
      select.value = "";
    }
  }


  function drawAdminAssignmentButtons() {
    const box = document.getElementById("adminAssignmentButtons");
    if (!box) return;

    box.innerHTML = "";

    REAL_ASSIGNMENTS.forEach(function(assignment) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerText = assignment;
      btn.classList.toggle("active-admin-schedule", assignment === currentAssignment);
      btn.onclick = function() {
        selectAdminAssignment(assignment);
      };
      box.appendChild(btn);
    });
  }

  async function selectAdminAssignment(assignment) {
    if (!requirePermission("editSchedules")) return;

    adminScheduleEditorFlowActive = true;
    currentAssignment = assignment;
    selectedCategory = "";

    const select = document.getElementById("adminAssignmentSelect");
    if (select) select.value = assignment;

    drawAdminAssignmentButtons();
    updateScheduleChoiceTitle();
    await loadAdminTasks();
    drawAdminCategories();
    showAdminView("adminScheduleChoiceView");
  }

  function updateScheduleChoiceTitle() {
    const title = document.getElementById("adminScheduleChoiceTitle");
    if (!title) return;

    title.innerText = currentAssignment
      ? currentAssignment + " Schedule Editor"
      : "Schedule Editor";
  }

  function backToScheduleEditorList() {
    currentAssignment = "";
    selectedCategory = "";
    updateScheduleChoiceTitle();
    drawAdminAssignmentButtons();
    showAdminView("adminScheduleEditorView");
  }

  function exitScheduleEditorToAdmin() {
    adminScheduleEditorFlowActive = false;
    currentAssignment = "";
    selectedCategory = "";
    drawAdminCategories();
    drawAdminAssignmentButtons();
    showAdminView("adminView2");
  }

  function syncModeControls() {
    const activeAssignments = getActiveAssignments();

    if (currentAssignment && !REAL_ASSIGNMENTS.includes(currentAssignment)) {
      currentAssignment = "";
    }

    updateAssignmentDropdownOptions("adminAssignmentSelect", true, "Choose schedule to edit");
    updateAssignmentDropdownOptions("adminEditAssignmentInput", true, "Select assignment");
    updateReassignmentDropdownOptions(false);
    drawAdminAssignmentButtons();

    const mainSelect = document.getElementById("adminAssignmentSelect");
    if (mainSelect) {
      mainSelect.value = currentAssignment || "";
    }

    updateModeToggleButtons();
  }

  function getReassignmentAssignments() {
    if (currentAssignment === "Laundry") {
      return ["Laundry"];
    }

    return REAL_ASSIGNMENTS.filter(function(assignment) {
      return assignment !== "Laundry";
    });
  }

  function getReassignmentCategories() {
    if (currentAssignment === "Laundry") {
      return ["Weekly Laundry", "Daily Laundry"];
    }

    return ["Common Area", "Weekly Room", "Daily Room", "Dehumidifier"];
  }

  function fillSelectOptions(selectId, options, includeBlank, blankText, selectedValue) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = "";

    if (includeBlank) {
      const blank = document.createElement("option");
      blank.value = "";
      blank.innerText = blankText || "Select";
      select.appendChild(blank);
    }

    options.forEach(function(value) {
      const option = document.createElement("option");
      option.value = value;
      option.innerText = value;
      select.appendChild(option);
    });

    if (selectedValue && options.includes(selectedValue)) {
      select.value = selectedValue;
    } else if (includeBlank) {
      select.value = "";
    } else if (options.length > 0) {
      select.value = options[0];
    }
  }

  function updateReassignmentDropdownOptions(resetValues) {
    const assignments = getReassignmentAssignments();
    const categories = getReassignmentCategories();

    const currentFrom = resetValues ? currentAssignment : document.getElementById("reassignFrom")?.value;
    const currentTo = resetValues ? "" : document.getElementById("reassignTo")?.value;
    const currentCategory = resetValues ? "" : document.getElementById("reassignCategory")?.value;

    fillSelectOptions("reassignFrom", assignments, true, "Select assignment", currentFrom);
    fillSelectOptions("reassignTo", assignments, true, "Select assignment", currentTo);
    fillSelectOptions("reassignCategory", categories, true, "Select category", currentCategory);
  }

  function getModeButtonText() {
    return housekeepingMode === "three"
      ? "SWITCH TO MODE 2"
      : "SWITCH TO MODE 3";
  }


  function updateModeToggleButtons() {
    const modeTwoButton = document.getElementById("modeTwoButton");
    const modeThreeButton = document.getElementById("modeThreeButton");

    if (modeTwoButton) {
      modeTwoButton.classList.toggle("active-mode", housekeepingMode !== "three");
    }

    if (modeThreeButton) {
      modeThreeButton.classList.toggle("active-mode", housekeepingMode === "three");
    }
  }

  async function setHousekeepingMode(targetMode) {
    if (!requirePermission("changeScheduleMode")) return;
    if (targetMode !== "two" && targetMode !== "three") return;
    if (housekeepingMode === targetMode) {
      updateModeToggleButtons();
      return;
    }

    const ok = confirm(
      targetMode === "three"
        ? "Switch to Mode 3 floor schedules?"
        : "Switch to Mode 2 HK1/HK2 schedules?"
    );

    if (!ok) return;

    showLoading();

    await setDoc(doc(db, "settings", "housekeepingmode"), {
      settingName: "housekeepingMode",
      settingValue: targetMode,
      notes: "Use two or three",
      updatedAt: serverTimestamp()
    }, { merge: true });

    housekeepingMode = targetMode;
    currentAssignment = "";
    selectedCategory = "";
    allAreas = [];
    allAreasForAssignment = [];
    allAreasForDay = [];
    allSubTasks = [];

    syncModeControls();
    drawAdminCategories();

    hideLoading();
    showAppMessage(
      targetMode === "three"
        ? "Mode 3 active. Use 1stfloor, 2ndFloor, and 3rdFloor."
        : "Mode 2 active. Use HK1 and HK2."
    );
  }

  async function toggleHousekeepingMode() {
    const newMode = housekeepingMode === "three" ? "two" : "three";
    await setHousekeepingMode(newMode);
  }

  /* =========================
     15 - ADMIN STARTUP
  ========================== */

  startAdmin().catch(function(error) {
    console.error("Admin startup failed", error);
    hideLoading();
    showAdminView("adminView2");
    showAppMessage("Admin could not finish loading. Please refresh and try again.");
  });

  function ensureAdminViewTag(viewId, labelText) {
    if (!isAdminUserRole) return;

    const view = document.getElementById(viewId);
    if (!view) return;
    if (view.querySelector(":scope > .view-tag")) return;

    const tag = document.createElement("div");
    tag.className = "view-tag";
    tag.innerText = labelText;
    view.insertBefore(tag, view.firstChild);
  }

  function setupAdminViewTags() {
    if (!isAdminUserRole) return;

    const viewLabels = {
      adminView2: "VIEW 2",
      adminScheduleEditorView: "VIEW 2A",
      adminScheduleChoiceView: "VIEW 2A-1",
      adminAreaView: "VIEW 3",
      adminEditView: "VIEW 7",
    
      adminRoomReportView: "VIEW 7R",
      adminDailyReportView: "VIEW 7D",
      adminEmployeesView: "VIEW 8",
      adminIssuesView: "VIEW 8B",
      adminDailyStatusView: "VIEW 8C",
      adminRoomSafeCheckView: "VIEW 8C-1",
      adminQuickToolsView: "VIEW 8C-2",
      adminIssueReasonsView: "VIEW 8D",
      adminMaintenanceDashboardView: "VIEW 8E-1",
      adminMaintenanceWorkBoardView: "VIEW 8E-2",
      adminMaintenanceInspectionView: "VIEW 8E-3",
      adminMaintenanceReportView: "VIEW 8E-4",
      adminMaintenanceMaterialsView: "VIEW 8E-5",
      adminPtacDashboardView: "VIEW 8F-1",
      adminPtacRoomsView: "VIEW 8F-2",
      adminPtacRoomView: "VIEW 8F-3",
      adminPtacHistoryView: "VIEW 8F-4",
      adminPtacNotesView: "VIEW 8F-5",
      adminPtacQueueView: "VIEW 8F-6",
      adminEmployeeEditView: "VIEW 9",
      adminReassignmentView: "VIEW 10",
      adminLaundryScheduleView: "VIEW 10-L",
      adminWorkloadView: "VIEW 11"
    };

    Object.keys(viewLabels).forEach(function(viewId) {
      ensureAdminViewTag(viewId, viewLabels[viewId]);
    });
  }

async function startAdmin() {
  setupAdminViewTags();
  await loadAdminModeOnly();

  const hash = String(window.location.hash || "").toLowerCase();
  const startView = sessionStorage.getItem("adminStartView") || "";
  const openCategory = sessionStorage.getItem("adminOpenCategory") || "";

  const isEmployeeAccessDashboard =
    hash === "#employee-dashboard" ||
    startView === "EmployeeDashboard" ||
    sessionStorage.getItem("employeeAccessDashboard") === "true";

  const isDehumidifierDeepLink =
    hash === "#dehumidifier" ||
    startView === "Dehumidifier" ||
    openCategory === "Dehumidifier";

  if (isEmployeeAccessDashboard) {
    sessionStorage.setItem("employeeAccessDashboard", "true");
    currentAssignment = adminDefaultAssignment || "";
    syncModeControls();
    openEmployeeAccessDashboard();
    return;
  }

  if (!hasPermission("adminDashboard") && !isDehumidifierDeepLink) {
    showAppMessage("Access not allowed.");
    setTimeout(function() {
      window.location.href = "index.html";
    }, 1200);
    return;
  }

  if (isDehumidifierDeepLink && !hasPermission("editRoomSettings") && !hasPermission("editSchedules")) {
    showAppMessage("Access not allowed.");
    setTimeout(function() {
      window.location.href = "index.html";
    }, 1200);
    return;
  }

  currentAssignment = "";
  syncModeControls();
  await loadAdminTasks();

  if (await openAdminDeepLinkIfNeeded()) {
    return;
  }

  drawAdminCategories();
  applyAdminPermissionVisibility();
  showAdminView("adminView2");
}

  async function loadAdminModeOnly() {
    showLoading();

    const settingsSnap = await getDocs(collection(db, "settings"));
    housekeepingMode = "two";

    settingsSnap.docs.forEach(function(docItem) {
      const data = docItem.data();
      if (data.settingName === "housekeepingMode" || docItem.id === "housekeepingmode") {
        housekeepingMode = String(data.settingValue || "two").toLowerCase();
      }
    });

    hideLoading();
  }

  async function openAdminDeepLinkIfNeeded() {
    const startView = sessionStorage.getItem("adminStartView") || "";
    const openMode = sessionStorage.getItem("adminOpenMode") || "";
    const openAssignment = sessionStorage.getItem("adminOpenAssignment") || "";
    const openCategory = sessionStorage.getItem("adminOpenCategory") || "";
    const openAreaId = sessionStorage.getItem("adminOpenAreaId") || "";
    const openAreaName = sessionStorage.getItem("adminOpenAreaName") || "";
    const openDay = sessionStorage.getItem("adminOpenDay") || "";
    const fromRoom = sessionStorage.getItem("adminDehumidifierFromRoom") || "";
    const fromAreaId = sessionStorage.getItem("adminDehumidifierFromAreaId") || "";
    const hash = String(window.location.hash || "").toLowerCase();

    const shouldOpenScheduleEditor =
      hash === "#schedule-editor" ||
      startView === "ScheduleEditor";

    const shouldOpenDehumidifier =
      hash === "#dehumidifier" ||
      startView === "Dehumidifier" ||
      openCategory === "Dehumidifier";

    if (!shouldOpenScheduleEditor && !shouldOpenDehumidifier) {
      return false;
    }

    [
      "adminStartView",
      "adminEditSource",
      "adminOpenMode",
      "adminOpenTaskView",
      "adminOpenAssignment",
      "adminOpenCategory",
      "adminOpenAreaId",
      "adminOpenAreaName",
      "adminOpenDay",
      "adminDehumidifierFromRoom",
      "adminDehumidifierFromAreaId"
    ].forEach(function(key) {
      sessionStorage.removeItem(key);
    });

    if (shouldOpenScheduleEditor) {
      if (!hasPermission("editSchedules")) {
        showAppMessage("Access not allowed.");
        return true;
      }

      currentAssignment = openAssignment || currentAssignment || adminDefaultAssignment || "";
      selectedCategory = openCategory || "";
      adminAreaSearchTerm = "";
      adminAreaTaskSearchTerm = "";
      adminBulkTaskOpen = false;
      adminAreaManualDayName = openDay || "";

      const searchInput = document.getElementById("adminAreaSearchInput");
      if (searchInput) searchInput.value = "";

      syncModeControls();
      await loadAdminTasks();

      if (!selectedCategory) {
        adminScheduleEditorFlowActive = true;
        updateScheduleChoiceTitle();
        drawAdminCategories();
        showAdminView(currentAssignment ? "adminScheduleChoiceView" : "adminScheduleEditorView");
        return true;
      }

      if (adminAreaManualDayName && isWeeklyCategory(selectedCategory)) {
        currentWorkDayName = adminAreaManualDayName;
      }

      adminScheduleEditorFlowActive = true;
      drawAdminAreaButtons(selectedCategory);

      if (openAreaId || openAreaName) {
        const area = findAdminDeepLinkArea(openAreaId, openAreaName, openCategory, openAssignment);

        if (area) {
          adminAreaOpenedFromDailyRoomAccess = openCategory === "Daily Room" && area.category === "Weekly Room";
          openAdminEditArea(area.id);

          if (openMode === "tasks") {
            openAdminAreaTasks();
          }

          return true;
        }

        showAdminView("adminAreaView");
        showAppMessage("Area not found.");
        return true;
      }

      showAdminView("adminAreaView");
      return true;
    }

    selectedCategory = "Dehumidifier";
    adminAreaSearchTerm = "";
    adminBulkTaskOpen = false;
    adminAreaManualDayName = "";

    const searchInput = document.getElementById("adminAreaSearchInput");
    if (searchInput) searchInput.value = "";

    if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAllAdminData();
    }

    drawAdminAreaButtons("Dehumidifier");
    showAdminView("adminAreaView");

    if (fromRoom || fromAreaId) {
      const fromArea = findDeepLinkDehumidifierFromRoom(fromRoom, fromAreaId);

      if (fromArea) {
        dehumidifierFromAreaId = fromArea.id;
        dehumidifierReassignStep = "to";
        drawAdminAreaButtons("Dehumidifier");
        showDehumidifierMoveToInput();
      } else {
        dehumidifierReassignStep = "from";
        dehumidifierFromAreaId = "";
        showAppMessage("No dehumidifier found for room " + fromRoom + ".");
      }
    }

    return true;
  }

  function findAdminDeepLinkArea(openAreaId, openAreaName, openCategory, openAssignment) {
    const cleanAreaId = String(openAreaId || "").trim();
    const cleanAreaName = String(openAreaName || "").trim();
    const cleanRoomKey = getRoomKey(cleanAreaName);
    const cleanCategory = String(openCategory || "").trim();
    const cleanAssignment = String(openAssignment || "").trim();

    return allAreas.find(function(area) {
      const areaAssignment = getAreaAssignment(area);
      const sameAssignment = !cleanAssignment || areaAssignment === cleanAssignment;
      const sameCategory =
        !cleanCategory ||
        area.category === cleanCategory ||
        (cleanCategory === "Daily Room" && area.category === "Weekly Room");

      if (!sameAssignment || !sameCategory) return false;

      if (cleanAreaId) {
        if (String(area.id || "") === cleanAreaId) return true;
        if (String(area.areaId || "") === cleanAreaId) return true;
        if (String(area.workId || "") === cleanAreaId) return true;
      }

      if (cleanRoomKey) {
        return getRoomKey(area.areaName || "") === cleanRoomKey;
      }

      return false;
    }) || null;
  }

  function findDeepLinkDehumidifierFromRoom(fromRoomValue, fromAreaIdValue) {
    const activeAssignments = getActiveHousekeepingAssignments();
    const cleanAreaId = String(fromAreaIdValue || "").trim();
    const cleanRoom = String(fromRoomValue || "").trim();

    if (cleanAreaId) {
      const idMatch = allAreas.find(function(area) {
        return area.category === "Dehumidifier" &&
          activeAssignments.includes(getAreaAssignment(area)) &&
          (String(area.id || "") === cleanAreaId ||
           String(area.areaId || "") === cleanAreaId ||
           String(area.workId || "") === cleanAreaId);
      });

      if (idMatch) return idMatch;
    }

    if (cleanRoom) {
      const roomKey = getRoomKey(cleanRoom);

      return allAreas.find(function(area) {
        return area.category === "Dehumidifier" &&
          activeAssignments.includes(getAreaAssignment(area)) &&
          getRoomKey(area.areaName) === roomKey;
      });
    }

    return null;
  }


  /* =========================
     15B - EMPLOYEE ACCESS DASHBOARD
  ========================== */

  function openEmployeeAccessDashboard() {
    const title = document.getElementById("employeeAccessDashboardTitle");
    const subtitle = document.getElementById("employeeAccessDashboardSubtitle");

    if (title) {
      title.innerText = (sessionData.firstName || sessionData.employeeName || "Employee") + " Dashboard";
    }

    if (subtitle) {
      subtitle.innerText = "";
      subtitle.classList.add("hidden");
    }

    setPermissionElementVisibility(
      "employeeWeeklySchedulesButton",
      hasPermission("housekeeping") || hasPermission("laundry")
    );

    setPermissionElementVisibility(
      "employeePtacButton",
      hasPermission("ptac")
    );

    showAdminView("employeeAccessDashboardView");
  }

  async function openWaterTemperatureView() {
    if (allAreas.length === 0) {
      await loadAllAdminData();
    }

    await loadWaterTemperatureView();
  }

  async function loadWaterTemperatureView() {
    showLoading();

    if (allAreas.length === 0) {
      await loadAllAdminData();
    }

    waterTemperatureSummaryOnly = false;
    waterTemperatureFloorFilter = "1";
    waterTemperatureLocations = buildWaterTemperatureLocations();
    await loadWaterTemperatureRecords();
    drawWaterTemperatureButtons();

    hideLoading();
    showAdminView("waterTemperatureView");
  }

  function buildWaterTemperatureLocations() {
    const map = {};

    allAreas.forEach(function(area) {
      const roomKey = getRoomKey(area.areaName || "");
      if (!/^\d{3}$/.test(roomKey)) return;
      if (String(area.category || "").includes("Laundry")) return;

      map[roomKey] = {
        locationKey: roomKey,
        locationName: roomKey,
        locationType: "Room"
      };
    });

    [
      "Kitchen Sink",
      "Kitchen Big Sink",
      "Kitchen Little Sink"
    ].forEach(function(name) {
      map[makeId(name)] = {
        locationKey: makeId(name),
        locationName: name,
        locationType: "Kitchen"
      };
    });

    return Object.keys(map).map(function(key) {
      return map[key];
    }).sort(function(a, b) {
      return String(a.locationName || "").localeCompare(String(b.locationName || ""), undefined, { numeric: true });
    });
  }

  async function loadWaterTemperatureRecords() {
    const snap = await getDocs(collection(db, "water_temperature_records"));

    allWaterTemperatureRecords = snap.docs.map(function(recordDoc) {
      return {
        id: recordDoc.id,
        ...recordDoc.data()
      };
    });
  }

  function drawWaterTemperatureButtons() {
    const box = document.getElementById("waterTemperatureGrid");
    const dateLabel = document.getElementById("waterTemperatureDateLabel");
    const today = getTodayISO();

    if (dateLabel) {
      dateLabel.innerText = "Date: " + formatDateWithWeekday(today) + (waterTemperatureSummaryOnly ? " - TEMP SUMMARY" : "");
    }

    updateWaterTemperatureSummaryButton();

    if (!box) return;
    box.innerHTML = "";

    let locationsToShow = waterTemperatureLocations;
    if (waterTemperatureFloorFilter === "1") {
  locationsToShow = locationsToShow.filter(function(location) {
    return /^1\d\d$/.test(String(location.locationName || ""));
  });
}

if (waterTemperatureFloorFilter === "2") {
  locationsToShow = locationsToShow.filter(function(location) {
    return /^2\d\d$/.test(String(location.locationName || ""));
  });
}

if (waterTemperatureFloorFilter === "3") {
  locationsToShow = locationsToShow.filter(function(location) {
    return /^3\d\d$/.test(String(location.locationName || ""));
  });
}

    const usedLabel = document.getElementById("waterTemperatureUsedLabel");
    const usedRooms = locationsToShow
      .filter(function(location) {
        const record = getWaterTemperatureRecordForLocation(location.locationKey, today);
        return !record && isWaterTemperatureLocationInRotation(location.locationKey, today);
      })
      .map(function(location) {
        return location.locationName;
      });

    if (usedLabel) {
      if (!waterTemperatureSummaryOnly && usedRooms.length > 0) {
        usedLabel.classList.remove("hidden");
        usedLabel.innerText = "Rooms used last week: " + usedRooms.join(", ");
      } else {
        usedLabel.classList.add("hidden");
        usedLabel.innerText = "";
      }
    }  
    

if (waterTemperatureSummaryOnly) {
  locationsToShow = locationsToShow.filter(function(location) {
    return getWaterTemperatureRecordForLocation(location.locationKey, today);
  });
}

    locationsToShow.forEach(function(location) {
      const record = getWaterTemperatureRecordForLocation(location.locationKey, today);

      if (!waterTemperatureSummaryOnly && !record && isWaterTemperatureLocationInRotation(location.locationKey, today)) {
        return;
      }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "water-temperature-button";

      if (record) {
        btn.classList.add(getWaterTemperatureButtonClass(record));
      }

      btn.innerHTML =
        '<strong>' + escapeHtml(location.locationName) + '</strong>' +
        '<small>' + escapeHtml(record ? getWaterTemperatureRecordLabel(record) : "Not checked") + '</small>';

      btn.onclick = function() {
        openWaterTemperatureInput(location);
      };

      box.appendChild(btn);
    });

    if (box.innerHTML === "") {
      const empty = document.createElement("h3");
      empty.innerText = waterTemperatureSummaryOnly
        ? "No temperatures saved for this date."
        : "No rooms available in rotation.";
      box.appendChild(empty);
    }
  }
function setWaterTemperatureFloorFilter(filterValue) {
  waterTemperatureFloorFilter = filterValue;
  drawWaterTemperatureButtons();
}
  function toggleWaterTemperatureSummary() {
    waterTemperatureSummaryOnly = !waterTemperatureSummaryOnly;
    drawWaterTemperatureButtons();
  }

  function updateWaterTemperatureSummaryButton() {
    const button = document.getElementById("waterTemperatureSummaryButton");
    if (!button) return;
    button.innerText = waterTemperatureSummaryOnly ? "ALL ROOMS" : "TEMP SUMMARY";
  }

  function getWaterTemperatureRecordForLocation(locationKey, workDateISO) {
    return allWaterTemperatureRecords.find(function(record) {
      return String(record.locationKey || "") === String(locationKey || "") &&
        String(record.workDateISO || "") === String(workDateISO || "");
    }) || null;
  }

  function getWaterTemperatureButtonClass(record) {
    const temperature = Number(record.temperature);

    if (Number.isFinite(temperature) && temperature < 105) {
      return "water-temperature-low";
    }

    if (String(record.result || "") === "Pass") {
      return "water-temperature-pass";
    }

    return "water-temperature-fail";
  }

  function getWaterTemperatureRecordLabel(record) {
    const temperature = Number(record.temperature);

    if (Number.isFinite(temperature) && temperature < 105) {
      return "LOW - " + temperature + "°";
    }

    if (String(record.result || "") === "Pass") {
      return "PASS - " + temperature + "°";
    }

    return "FAIL - " + temperature + "°";
  }

  function isWaterTemperatureLocationInRotation(locationKey, todayISO) {
    const todayTime = getISODateTime(todayISO);

    return allWaterTemperatureRecords.some(function(record) {
      const recordDate = String(record.workDateISO || "").slice(0, 10);
      if (!recordDate || recordDate === todayISO) return false;
      if (String(record.locationKey || "") !== String(locationKey || "")) return false;

      const recordTime = getISODateTime(recordDate);
      if (!recordTime || !todayTime) return false;

      const daysSinceChecked = Math.floor((todayTime - recordTime) / 86400000);
      return daysSinceChecked > 0 && daysSinceChecked <= 14;
    });
  }

  function getISODateTime(isoDate) {
    const cleanDate = String(isoDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return 0;
    return new Date(cleanDate + "T00:00:00").getTime();
  }

  function addDaysToISO(isoDate, days) {
    const cleanDate = String(isoDate || "").slice(0, 10);
    const date = new Date(cleanDate + "T00:00:00");
    date.setDate(date.getDate() + Number(days || 0));
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }


  function openWaterTemperatureInput(location) {
    showAppInputConfirmMessage(
      "Enter temperature for " + location.locationName + ". Passing range is 105 to 118.",
      async function(value) {
        await saveWaterTemperatureRecord(location, value);
      },
      function() {
        showAdminView("waterTemperatureView");
      },
      "Water Temperature"
    );

    const input = document.getElementById("appMessageInput");
    if (input) {
      input.placeholder = "Temperature";
      input.setAttribute("inputmode", "decimal");
      input.setAttribute("maxlength", "5");
      input.removeAttribute("pattern");
      input.oninput = function() { limitTemperatureInput(this); };
    }
  }

  function limitTemperatureInput(input) {
    input.value = String(input.value || "")
      .replace(/[^0-9.]/g, "")
      .replace(/(\..*)\./g, "$1")
      .slice(0, 5);
  }

  async function saveWaterTemperatureRecord(location, value) {
    const temperature = Number(String(value || "").trim());

    if (!Number.isFinite(temperature)) {
      showAppMessage("Enter temperature.", "Water Temperature");
      return;
    }

    const today = getTodayISO();
    const result = temperature < 105 ? "Low" : (temperature <= 118 ? "Pass" : "Fail");
    const availableAgainDateISO = addDaysToISO(today, 15);
    const recordId = makeId(today + "_" + location.locationKey);

    showLoading();

    await setDoc(doc(db, "water_temperature_records", recordId), {
      locationKey: location.locationKey,
      locationName: location.locationName,
      locationType: location.locationType,
      temperature: temperature,
      result: result,
      workDateISO: today,
      rotationDays: 14,
      availableAgainDateISO: availableAgainDateISO,
      employeeId: sessionData.employeeId || sessionData.id || "",
      employeeName: sessionData.employeeName || sessionData.name || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    await loadWaterTemperatureRecords();
    drawWaterTemperatureButtons();

    hideLoading();
    showAdminView("waterTemperatureView");
  }

  async function confirmDeleteWaterTemperatureRecords() {
    const ok = await showAppConfirmMessage(
      "Are you sure?",
      "Confirm Delete"
    );

    if (!ok) {
      await loadWaterTemperatureView();
      return;
    }

    await deleteAllWaterTemperatureRecords();
    await loadWaterTemperatureView();
  }

  async function deleteAllWaterTemperatureRecords() {
    showLoading();

    const snap = await getDocs(collection(db, "water_temperature_records"));
    let batch = writeBatch(db);
    let count = 0;

    for (let i = 0; i < snap.docs.length; i++) {
      batch.delete(doc(db, "water_temperature_records", snap.docs[i].id));
      count++;

      if (count % 450 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }

    await batch.commit();
    allWaterTemperatureRecords = [];

    hideLoading();
  }

  function openWeeklySchedulesFromEmployeeDashboard() {
    window.location.href = "schedule.html";
  }

  async function openPtacFromEmployeeDashboard() {
    if (!requirePermission("ptac")) return;
    await openPtacDashboard();
  }

  /* =========================
     16 - LOADING FUNCTIONS
  ========================== */

  function showLoading() {
    document.getElementById("loadingScreen").classList.remove("hidden");
  }

  function hideLoading() {
    document.getElementById("loadingScreen").classList.add("hidden");
  }

  /* =========================
     16B - CUSTOM MESSAGE FUNCTIONS
  ========================== */

  function setAppMessageButtons(showCancel) {
    const actions = document.getElementById("appMessageActions");
    const cancelButton = document.getElementById("appMessageCancelButton");

    if (actions) {
      actions.classList.toggle("single-action", !showCancel);
    }

    if (cancelButton) {
      cancelButton.classList.toggle("hidden", !showCancel);
    }
  }

  function showAppMessage(message, title) {
    const input = document.getElementById("appMessageInput");
    appMessageInputCallback = null;
    appMessageCancelCallback = null;
    setAppMessageButtons(false);

    if (input) {
      input.value = "";
      input.placeholder = "Room number";
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "3");
      input.setAttribute("pattern", "[0-9]*");
      input.oninput = function() { limitRoomInput(this); };
      input.classList.add("hidden");
    }

    document.getElementById("appMessageTitle").innerText = title || "Notice";
    document.getElementById("appMessageText").innerText = message;
    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  function showAppInputMessage(message, callback, title) {
    const input = document.getElementById("appMessageInput");
    appMessageInputCallback = callback;
    appMessageCancelCallback = null;
    setAppMessageButtons(false);
    document.getElementById("appMessageTitle").innerText = title || "Notice";
    document.getElementById("appMessageText").innerText = message;

    if (input) {
      input.value = "";
      input.placeholder = "Room number";
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "3");
      input.setAttribute("pattern", "[0-9]*");
      input.oninput = function() { limitRoomInput(this); };
      input.classList.remove("hidden");
      setTimeout(function() { input.focus(); }, 50);
    }

    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  function showAppInputConfirmMessage(message, callback, cancelCallback, title) {
    const input = document.getElementById("appMessageInput");
    appMessageInputCallback = callback;
    appMessageCancelCallback = cancelCallback || function() {};
    setAppMessageButtons(true);

    document.getElementById("appMessageTitle").innerText = title || "Notice";
    document.getElementById("appMessageText").innerText = message;

    if (input) {
      input.value = "";
      input.placeholder = "Room number";
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "3");
      input.setAttribute("pattern", "[0-9]*");
      input.oninput = function() { limitRoomInput(this); };
      input.classList.remove("hidden");
      setTimeout(function() { input.focus(); }, 50);
    }

    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  function showAppConfirmMessage(message, title) {
    const input = document.getElementById("appMessageInput");
    const okButton = document.getElementById("appMessageOkButton");
    const cancelButton = document.getElementById("appMessageCancelButton");
    setAppMessageButtons(true);

    if (input) {
      input.value = "";
      input.placeholder = "Room number";
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "3");
      input.setAttribute("pattern", "[0-9]*");
      input.oninput = function() { limitRoomInput(this); };
      input.classList.add("hidden");
    }

const actions = document.getElementById("appMessageActions");

if (actions) {
  actions.className = "app-message-actions";
  actions.innerHTML =
    '<button id="appMessageOkButton" class="green" onclick="confirmAppMessage()">OK</button>' +
    '<button id="appMessageCancelButton" class="back" onclick="cancelAppMessage()">CANCEL</button>';
}

document.getElementById("appMessageTitle").innerText = title || "Confirm";
    document.getElementById("appMessageText").innerText = message;
    document.getElementById("appMessageBox").classList.remove("hidden");

    return new Promise(function(resolve) {
      appMessageInputCallback = function() {
        resolve(true);
      };
      appMessageCancelCallback = function() {
        resolve(false);
      };
    });
  }

  function confirmAppMessage() {
    const input = document.getElementById("appMessageInput");

    if (appMessageInputCallback) {
      const callback = appMessageInputCallback;
      const value = input ? input.value.trim() : "";
      appMessageInputCallback = null;
      appMessageCancelCallback = null;
      closeAppMessage();
      callback(value);
      return;
    }

    closeAppMessage();
  }

  function cancelAppMessage() {
    if (appMessageCancelCallback) {
      const callback = appMessageCancelCallback;
      appMessageInputCallback = null;
      appMessageCancelCallback = null;
      closeAppMessage();
      callback();
      return;
    }

    closeAppMessage();
  }

  function closeAppMessage() {
    const input = document.getElementById("appMessageInput");
    const okButton = document.getElementById("appMessageOkButton");
    const cancelButton = document.getElementById("appMessageCancelButton");
    appMessageInputCallback = null;
    appMessageCancelCallback = null;
    setAppMessageButtons(false);

    if (input) {
      input.value = "";
      input.placeholder = "Room number";
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "3");
      input.setAttribute("pattern", "[0-9]*");
      input.oninput = function() { limitRoomInput(this); };
      input.classList.add("hidden");
    }

    if (okButton) okButton.innerText = "OK";
    if (cancelButton) cancelButton.innerText = "CANCEL";

    document.getElementById("appMessageBox").classList.add("hidden");
  }

  /* =========================
     17 - VIEW SWITCHING
  ========================== */

  function showAdminView(viewId) {
    [
      "adminView2",
      "adminScheduleEditorView",
      "adminScheduleChoiceView",
      "employeeAccessDashboardView",
      "waterTemperatureView",
      "adminAreaView",
      "adminEditView",
      "adminAreaTaskView",
      "adminRoomReportView",
      "adminDailyReportView",
      "adminEmployeesView",
      "adminIssuesView",
      "adminDailyStatusView",
      "adminRoomSafeCheckView",
      "adminQuickToolsView",
      "adminIssueReasonsView",
      "adminMaintenanceDashboardView",
      "adminMaintenanceWorkBoardView",
      "adminMaintenanceInspectionView",
      "adminMaintenanceReportView",
      "adminMaintenanceMaterialsView",
      "adminPtacDashboardView",
      "adminPtacRoomsView",
      "adminPtacRoomView",
      "adminPtacHistoryView",
      "adminPtacNotesView",
      "adminPtacQueueView",
      "adminEmployeeEditView",
      "adminReassignmentView",
      "adminLaundryScheduleView",
      "adminWorkloadView"
    ].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });

    updateAssignmentTitles();
    document.getElementById(viewId).classList.remove("hidden");
  }

  function updateAssignmentTitles() {
    [
      "adminAreaAssignmentTitle",
      "adminEditAssignmentTitle",
      "adminAreaTasksAssignmentTitle",
      "adminSubtaskAssignmentTitle",
      "adminEmployeesAssignmentTitle",
      "adminIssuesAssignmentTitle",
      "adminDailyStatusAssignmentTitle",
      "adminIssueReasonsAssignmentTitle",
      "adminMaintenanceDashboardAssignmentTitle",
      "adminMaintenanceWorkBoardAssignmentTitle",
      "adminMaintenanceInspectionAssignmentTitle",
      "adminMaintenanceReportAssignmentTitle",
      "adminMaintenanceMaterialsAssignmentTitle",
      "adminPtacDashboardAssignmentTitle",
      "adminPtacRoomsAssignmentTitle",
      "adminPtacRoomAssignmentTitle",
      "adminPtacHistoryAssignmentTitle",
      "adminPtacNotesAssignmentTitle",
      "adminPtacQueueAssignmentTitle",
      "adminEmployeeEditAssignmentTitle"
    ].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) el.innerText = currentAssignment;
    });

    const areaModeLabel = document.getElementById("adminAreaModeLabel");
    if (areaModeLabel) {
      areaModeLabel.innerText =
        housekeepingMode === "three"
          ? "MODE 3 ACTIVE"
          : "MODE 2 ACTIVE";
    }
  }

  /* =========================
     18 - DATE FUNCTIONS
  ========================== */

  function getTodayISO() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function getWeekdayName(iso) {
    const date = new Date(iso + "T00:00:00");
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  }

  function updateDateDisplay() {
    currentWorkDayName = getWeekdayName(currentWorkDateISO);
  }

  function updateReassignmentDateDisplay() {
    const label = document.getElementById("reassignShowingLabel");
    const fromAssignment = document.getElementById("reassignFrom")?.value || "";
    const toAssignment = document.getElementById("reassignTo")?.value || "";
    const category = document.getElementById("reassignCategory")?.value || "";

    if (label) {
      if (category === "Dehumidifier") {
        label.innerText = "Dehumidifier room move";
      } else if (category && isWeeklyCategory(category) && reassignWorkDayName) {
        label.innerText =
          "Showing " + fromAssignment + " - " + category + " for " + reassignWorkDayName +
          (toAssignment && reassignTargetDayName ? " → Move to " + toAssignment + " - " + reassignTargetDayName : "");
      } else if (category) {
        label.innerText = "Showing " + fromAssignment + " - " + category + (toAssignment ? " → Move to " + toAssignment : "");
      } else {
        label.innerText = fromAssignment ? "Choose category for " + fromAssignment : "";
      }
    }

    updateReassignmentDayButtons();
  }

  async function setReassignmentFromWeekday(dayName) {
    reassignWorkDayName = dayName;
    reassignTargetDayName = dayName;
    updateReassignmentDateDisplay();
    await loadReassignmentAreas();
  }

  function setReassignmentToWeekday(dayName) {
    reassignTargetDayName = dayName;
    updateReassignmentDateDisplay();
  }

  function updateReassignmentDayButtons() {
    const dayMap = {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday"
    };

    Array.from(document.querySelectorAll("#reassignFromDayButtons button")).forEach(function(button) {
      const fullDay = dayMap[button.innerText] || button.innerText;
      button.classList.toggle("active-day", fullDay === reassignWorkDayName);
    });

    Array.from(document.querySelectorAll("#reassignToDayButtons button")).forEach(function(button) {
      const fullDay = dayMap[button.innerText] || button.innerText;
      button.classList.toggle("active-day", fullDay === reassignTargetDayName);
    });

    drawReassignmentToPreview();
  }

  function drawReassignmentToPreview() {
    const label = document.getElementById("reassignToPreviewLabel");
    const select = document.getElementById("reassignmentToAreaPreview");

    if (!label || !select) return;

    const toAssignment = document.getElementById("reassignTo")?.value || "";
    const category = document.getElementById("reassignCategory")?.value || "";

    label.innerText = "";
    select.innerHTML = '<option value="">Select destination to preview rooms</option>';

    if (!toAssignment || !category) return;

    if (isWeeklyCategory(category) && !reassignTargetDayName) return;

    const areas = allAreas.filter(function(area) {
      if (getAreaAssignment(area) !== toAssignment) return false;
      if (area.category !== category) return false;
      if (isWeeklyCategory(category)) {
        return String(area.scheduleDay || "").trim().toLowerCase() === reassignTargetDayName.toLowerCase();
      }
      return true;
    }).sort(function(a, b) {
      return String(a.areaName || "").localeCompare(String(b.areaName || ""), undefined, { numeric: true });
    });

    label.innerText = isWeeklyCategory(category)
      ? "To " + toAssignment + " - " + reassignTargetDayName
      : "To " + toAssignment;

    if (areas.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.innerText = isWeeklyCategory(category) ? "No rooms on " + reassignTargetDayName : "No rooms found";
      select.appendChild(empty);
      return;
    }

    areas.forEach(function(area) {
      const count = getTasksForWorkId(area.workId).length;
      const option = document.createElement("option");
      option.value = area.id;
      option.innerText = area.areaName + " - " + getAreaAssignment(area) + " - " + count + " TASKS";
      select.appendChild(option);
    });
  }

  async function changeAdminWorkDateFromBigPicker() {
    return;
  }

  function setAdminAreaWeekday(dayName) {
    adminAreaManualDayName = dayName;
    currentWorkDayName = dayName;
    drawAdminAreaButtons(selectedCategory);
    showAdminView("adminAreaView");
  }

  function updateAdminAreaDayButtons() {
    const dayMap = {
      Mon: "Monday",
      Tue: "Tuesday",
      Wed: "Wednesday",
      Thu: "Thursday",
      Fri: "Friday",
      Sat: "Saturday",
      Sun: "Sunday"
    };

    Array.from(document.querySelectorAll("#adminAreaWeekdayButtons button")).forEach(function(button) {
      const fullDay = dayMap[button.innerText] || button.innerText;
      button.classList.toggle("active-day", fullDay === currentWorkDayName);
    });
  }

  /* =========================
     19 - ASSIGNMENT CHANGE
  ========================== */

  async function changeAdminAssignment() {
    if (!requirePermission("editSchedules")) return;
    adminScheduleEditorFlowActive = true;
    currentAssignment = document.getElementById("adminAssignmentSelect").value;
    selectedCategory = "";
    drawAdminAssignmentButtons();
    updateScheduleChoiceTitle();
    await loadAdminTasks();
    drawAdminCategories();
    showAdminView(currentAssignment ? "adminScheduleChoiceView" : "adminScheduleEditorView");
  }

  /* =========================
     20 - LOAD AREAS AND SUB TASKS
  ========================== */

  async function loadAdminTasks() {
    showLoading();
    updateDateDisplay();
    if (adminAreaManualDayName && selectedCategory && isWeeklyCategory(selectedCategory)) {
      currentWorkDayName = adminAreaManualDayName;
    }
    updateAssignmentTitles();

    const dateTitle = document.getElementById("adminAreaDateTitle");
    if (dateTitle) dateTitle.innerText = currentWorkDayName;

    const settingsSnap = await getDocs(collection(db, "settings"));
    housekeepingMode = "two";

    settingsSnap.docs.forEach(function(docItem) {
      const data = docItem.data();
      if (data.settingName === "housekeepingMode" || docItem.id === "housekeepingmode") {
        housekeepingMode = String(data.settingValue || "two").toLowerCase();
      }
    });

    syncModeControls();

    const areaSnap = await getDocs(collection(db, "areas"));

    allAreas = areaSnap.docs.map(function(areaDoc) {
      return normalizeArea({ id: areaDoc.id, ...areaDoc.data() });
    }).filter(function(area) {
      return area.active !== false && area.active !== "No";
    });

    const subTaskSnap = await getDocs(collection(db, "tasks"));

    allSubTasks = subTaskSnap.docs.map(function(taskDoc) {
      return normalizeSubTask({ id: taskDoc.id, ...taskDoc.data() });
    }).filter(function(task) {
      return task.active !== false && task.active !== "No";
    });

    roomSettingsData = await loadAdminRoomSettings();

    if (currentAssignment) {
      allAreasForAssignment = allAreas.filter(function(area) {
        return getAreaAssignment(area) === currentAssignment;
      });

      allAreasForDay = allAreasForAssignment.filter(function(area) {
        return isAreaForCurrentDay(area);
      });
    } else {
      allAreasForAssignment = [];
      allAreasForDay = [];
    }

    updateTaskNameOptions();
    drawAdminCategories();
    hideLoading();
  }

  async function loadAdminRoomSettings() {
    const snap = await getDocs(collection(db, "room_settings"));
    const data = {};
    allRoomSettings = [];

    snap.docs.forEach(function(item) {
      const setting = {
        id: item.id,
        ...item.data()
      };

      const assignment = String(setting.schedule || "");
      const roomKey = getRoomKey(setting.roomKey || setting.roomName || "");
      if (!assignment || !roomKey) return;

      setting.roomKey = roomKey;
      allRoomSettings.push(setting);
      data[assignment + "|" + roomKey] = setting;

      if (assignment === String(currentAssignment || "")) {
        data[roomKey] = setting;
      }
    });

    return data;
  }

  function normalizeArea(area) {
    area.areaName = area.areaName || area.area || area.name || "";
    area.category = area.category || "";
    area.scheduleDay = area.scheduleDay || area.day || "daily";
    area.day = area.day || area.scheduleDay;
    area.schedule = area.schedule || "";
    area.modeType = area.modeType || "two";
    area.workId = area.areaId || area.workId || area.id || buildAreaId(area.modeType, area.schedule, area.category, area.scheduleDay, area.areaName, area.floor, area.laundryType);
    area.areaId = area.areaId || area.workId;
    return area;
  }

  function normalizeSubTask(task) {
    task.taskName = task.taskName || task.task || "";
    task.workId = task.areaId || task.workId || "";
    task.areaId = task.areaId || task.workId;
    return task;
  }

  function getAreaAssignment(area) {
    return String(area.schedule || "").trim();
  }

  function isWeeklyCategory(category) {
    return category === "Weekly Room" || category === "Weekly Laundry";
  }

  function isDailyOnlyCategory(category) {
    return !isWeeklyCategory(category);
  }

  function isAreaForCurrentDay(area) {
    const schedule = String(area.scheduleDay || "").trim().toLowerCase();
    if (isDailyOnlyCategory(area.category)) return schedule === "daily" || schedule === "";
    return schedule === currentWorkDayName.toLowerCase();
  }

  function isAreaForReassignDay(area) {
    const schedule = String(area.scheduleDay || "").trim().toLowerCase();
    if (isDailyOnlyCategory(area.category)) return schedule === "daily" || schedule === "";
    return schedule === reassignWorkDayName.toLowerCase();
  }

  function getTasksForWorkId(workId) {
    return allSubTasks.filter(function(task) {
      return String(task.workId || "") === String(workId || "");
    });
  }

  function buildWorkId(areaName, category, scheduleDay, assignment) {
    const modeType = getModeTypeForAssignment(assignment);
    return buildAreaId(modeType, assignment, category, scheduleDay, areaName, getFloorForAssignment(assignment), "");
  }

  function buildAreaId(modeType, schedule, category, day, areaName, floor, laundryType) {
    return makeId([
      modeType,
      schedule,
      category,
      day,
      areaName,
      floor,
      laundryType
    ].join("_"));
  }

  function makeId(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "blank";
  }

  function getModeTypeForAssignment(assignment) {
    if (assignment === "Laundry") return "laundry";
    if (["1stfloor", "2ndFloor", "3rdFloor"].includes(assignment)) return "three";
    return "two";
  }

  function getFloorForAssignment(assignment) {
    if (["1stfloor", "2ndFloor", "3rdFloor"].includes(assignment)) return assignment;
    return "";
  }

  function getAreaUpdateData(areaName, assignment, category, scheduleDay, workId) {
    const modeType = getModeTypeForAssignment(assignment);
    const floor = getFloorForAssignment(assignment);

    return {
      areaId: workId,
      areaName: areaName,
      areaSearch: String(areaName || "").toLowerCase(),
      category: category,
      categoryKey: makeId(category),
      day: scheduleDay,
      scheduleDay: scheduleDay,
      schedule: assignment,
      modeType: modeType,
      modeLabel: assignment,
      floor: floor,
      laundryType: assignment === "Laundry" ? "Regular" : "",
      sourceSheet: "admin",
      active: true,
      updatedAt: serverTimestamp()
    };
  }

  /* =========================
     21 - UPDATE TASK NAME OPTIONS
  ========================== */

  function updateTaskNameOptions() {
    const list = document.getElementById("taskNameOptions");
    if (!list) return;

    list.innerHTML = "";

    const names = [...new Set(allSubTasks.map(function(task) {
      return String(task.taskName || "").trim();
    }).filter(function(name) {
      return name !== "";
    }))];

    names.forEach(function(name) {
      const option = document.createElement("option");
      option.value = name;
      list.appendChild(option);
    });
  }

  /* =========================
     22 - DRAW CATEGORY BUTTONS
  ========================== */

  function drawAdminCategories() {
    const topBox = document.getElementById("adminTopButtons");
    const scheduleBox = document.getElementById("adminCategoryButtons");
    const scheduleToolBox = document.getElementById("adminScheduleToolButtons");

    if (topBox) topBox.innerHTML = "";
    if (scheduleBox) scheduleBox.innerHTML = "";
    if (scheduleToolBox) scheduleToolBox.innerHTML = "";

    updateScheduleChoiceTitle();

    const topButtons = ["User View", "Luis Dashboard", "Schedule Editor", "Rooms Assignments", "Daily Status", "Issues", "Issue Reasons", "Maintenance Inspection", "PTAC", "Main Door", "Logout"];

    let scheduleButtons = [];

    if (currentAssignment === "Laundry") {
      scheduleButtons = ["Weekly Laundry", "Daily Laundry"];
    } else if (currentAssignment) {
      scheduleButtons = ["Dehumidifier", "Common Area", "Weekly Room", "Daily Room"];
    }

    topButtons.forEach(function(item) {
      if (canOpenAdminDashboardItem(item)) {
        appendAdminDashboardButton(topBox, item);
      }
    });

    scheduleButtons.forEach(function(item) {
      if (canOpenAdminDashboardItem(item)) {
        appendAdminDashboardButton(scheduleBox, item);
      }
    });

    applyAdminPermissionVisibility();
  }

  function appendAdminDashboardButton(box, item) {
    if (!box) return;

    const btn = document.createElement("button");
    btn.innerText = item;

    if (item === "Logout") {
      btn.className = "back";
      btn.onclick = logout;
    } else {
      btn.className = "yellow";

      if (item === "User View") {
        btn.onclick = function() { window.location.href = "schedule.html"; };
      } else if (item === "Luis Dashboard") {
        btn.onclick = function() {
          currentAssignment = adminDefaultAssignment || "";
          openEmployeeAccessDashboard();
        };
      } else if (item === "Schedule Editor") {
        btn.onclick = openScheduleEditor;
      } else if (item === "Employees") {
        btn.onclick = openEmployees;
      } else if (item === "Issues") {
        btn.onclick = openIssues;
      } else if (item === "Issue Reasons") {
        btn.onclick = openIssueReasons;
      } else if (item === "Maintenance Inspection") {
        btn.onclick = openMaintenanceDashboard;
      } else if (item === "PTAC") {
        btn.onclick = openPtacDashboard;
      } else if (item === "Daily Status") {
        btn.onclick = openDailyStatus;
      } else if (item === "Rooms Assignments") {
        btn.onclick = openRoomSafeCheck;
      } else if (item === "Main Door" || item === "Room / Area Tools") {
        btn.onclick = openQuickToolsView;
      } else if (item === "Reports") {
        btn.onclick = function() { window.location.href = "reports.html"; };
      } else {
        btn.onclick = function() {
          openAdminCategory(item);
        };
      }
    }

    box.appendChild(btn);
  }

  async function loadAllAdminData() {
    showLoading();
    updateDateDisplay();

    const settingsSnap = await getDocs(collection(db, "settings"));
    housekeepingMode = "two";

    settingsSnap.docs.forEach(function(docItem) {
      const data = docItem.data();
      if (data.settingName === "housekeepingMode" || docItem.id === "housekeepingmode") {
        housekeepingMode = String(data.settingValue || "two").toLowerCase();
      }
    });

    syncModeControls();

    const areaSnap = await getDocs(collection(db, "areas"));

    allAreas = areaSnap.docs.map(function(areaDoc) {
      return normalizeArea({ id: areaDoc.id, ...areaDoc.data() });
    }).filter(function(area) {
      return area.active !== false && area.active !== "No";
    });

    const subTaskSnap = await getDocs(collection(db, "tasks"));

    allSubTasks = subTaskSnap.docs.map(function(taskDoc) {
      return normalizeSubTask({ id: taskDoc.id, ...taskDoc.data() });
    }).filter(function(task) {
      return task.active !== false && task.active !== "No";
    });

    roomSettingsData = await loadAdminRoomSettings();

    allAreasForAssignment = currentAssignment
      ? allAreas.filter(function(area) { return getAreaAssignment(area) === currentAssignment; })
      : [];

    allAreasForDay = allAreasForAssignment.filter(function(area) {
      return isAreaForCurrentDay(area);
    });

    updateTaskNameOptions();
    drawAdminCategories();
    hideLoading();
  }

  async function openAdminCategory(item) {
    if (!canOpenAdminDashboardItem(item)) {
      showAppMessage("Access not allowed.");
      return;
    }

    if (["Common Area", "Weekly Room", "Daily Room", "Weekly Laundry", "Daily Laundry"].includes(item) && !currentAssignment) {
      showAppMessage("Choose schedule first.");
      return;
    }

    selectedCategory = item;
    adminAreaSearchTerm = "";
    adminBulkTaskOpen = false;
    adminAreaManualDayName = "";

    const searchInput = document.getElementById("adminAreaSearchInput");
    if (searchInput) searchInput.value = "";

    if (item === "Dehumidifier" && (allAreas.length === 0 || allSubTasks.length === 0)) {
      await loadAllAdminData();
    } else if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAdminTasks();
    }

    drawAdminAreaButtons(item);
    showAdminView("adminAreaView");
  }

  async function openScheduleEditor() {
    if (!requirePermission("editSchedules")) return;

    adminScheduleEditorFlowActive = true;
    selectedCategory = "";
    adminAreaSearchTerm = "";
    adminAreaTaskSearchTerm = "";
    adminBulkTaskOpen = false;

    syncModeControls();
    updateScheduleChoiceTitle();

    if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAdminTasks();
    } else {
      drawAdminCategories();
    }

    showAdminView("adminScheduleEditorView");
  }

  /* =========================
     23 - DRAW AREA BUTTONS
  ========================== */

  function drawAdminAreaButtons(category) {
    const box = document.getElementById("adminAreaButtons");
    box.innerHTML = "";

    document.getElementById("adminAreaTitle").innerText = category;

    setAdminAreaViewTag(category);
    setAdminAreaDatePickerVisibility(category);
    setAdminAreaSearchVisibility(category);
    setAdminBulkTaskBoxVisibility(category);
    setDehumidifierReassignButtonVisibility(category);

    document.getElementById("adminAddAreaButton").innerText = "ADD NEW " + category.toUpperCase();
    document.getElementById("adminAreaDateTitle").innerText = currentWorkDayName;
    updateAdminAreaDayButtons();

    updateAssignmentTitles();

    const viewTag = document.getElementById("adminAreaViewTag");
    const modeLabel = document.getElementById("adminAreaModeLabel");
    const title = document.getElementById("adminAreaAssignmentTitle");

    if (category === "Dehumidifier") {
      if (viewTag) viewTag.classList.add("hidden");
      if (modeLabel) modeLabel.classList.add("hidden");
      if (title) title.innerText = "";
    } else {
      if (viewTag) viewTag.classList.remove("hidden");
      if (modeLabel) modeLabel.classList.remove("hidden");
    }

    let areas = [];

    if (category === "Dehumidifier") {
      areas = allAreas.filter(function(area) {
        return area.category === "Dehumidifier" &&
          getAreaAssignment(area) === currentAssignment;
      });
    } else if (category === "Daily Room") {
      const areasByDoor = {};

      allAreasForAssignment.forEach(function(area) {
        if (area.category !== "Daily Room" && area.category !== "Weekly Room") return;
        if (area.category === "Daily Room" && !isAreaForCurrentDay(area)) return;

        const roomKey = getRoomKey(area.areaName || "");
        if (!roomKey) return;

        const doorKey = getAreaAssignment(area) + "|" + roomKey;
        const setting = roomSettingsData[roomKey] || {};

        if (area.category === "Weekly Room") {
          if (setting.isDaily !== true) return;
          areasByDoor[doorKey] = area;
          return;
        }

        if (!areasByDoor[doorKey]) {
          areasByDoor[doorKey] = area;
        }
      });

      areas = Object.keys(areasByDoor).map(function(key) {
        return areasByDoor[key];
      });
    } else {
      areas = allAreasForAssignment.filter(function(area) {
        if (area.category !== category) return false;
        if (isWeeklyCategory(category)) {
          return String(area.scheduleDay || "").trim().toLowerCase() === currentWorkDayName.toLowerCase();
        }
        return isAreaForCurrentDay(area);
      });
    }

    if (adminAreaSearchTerm) {
      areas = areas.filter(function(area) {
        return String(area.areaName || "").toLowerCase().includes(adminAreaSearchTerm.toLowerCase());
      });
    }

    areas = areas.sort(function(a, b) {
      return String(a.areaName || "").localeCompare(String(b.areaName || ""), undefined, { numeric: true });
    });

    areas.forEach(function(area) {
      const total = getTasksForWorkId(area.workId).length;
      const btn = document.createElement("button");

      if (category === "Dehumidifier") {
        btn.className = total > 0 ? "" : "red";

        if (dehumidifierReassignStep && area.id === dehumidifierFromAreaId) {
          btn.classList.add("selected-reassign-area");
        }

        btn.innerHTML =
          '<div class="room-number">' + escapeHtml(area.areaName) + '</div>';

        btn.onclick = function() {
          if (dehumidifierReassignStep) {
            handleDehumidifierReassignRoomClick(area.id);
            return;
          }

          adminAreaOpenedFromDailyRoomAccess = false;
          openAdminEditArea(area.id);
        };
      } else {
        btn.className = total > 0 ? "" : "red";
        btn.innerHTML =
          '<div class="room-number">' + escapeHtml(area.areaName) + '</div>' +
          '<div class="room-counter">' + escapeHtml(total + " TASKS") + '</div>';

        const openedFromDailyRoomAccess =
          category === "Daily Room" &&
          area.category === "Weekly Room" &&
          ((roomSettingsData[getRoomKey(area.areaName || "")] || {}).isDaily === true);

        btn.onclick = function() {
          adminAreaOpenedFromDailyRoomAccess = openedFromDailyRoomAccess;
          openAdminEditArea(area.id);
        };
      }

      box.appendChild(btn);
    });

    if (box.innerHTML === "") {
      const empty = document.createElement("h3");
      empty.innerText =
        category === "Dehumidifier"
          ? "No dehumidifier found in this room."
          : "No areas found.";
      box.appendChild(empty);
    }
  }

  function setDehumidifierReassignButtonVisibility(category) {
    const button = document.getElementById("adminReassignDehumidifierButton");
    if (!button) return;
    button.classList.toggle("hidden", category !== "Dehumidifier");
  }

  function openDehumidifierReassignment() {
    selectedCategory = "Dehumidifier";
    dehumidifierReassignStep = "from";
    dehumidifierFromAreaId = "";
    drawAdminAreaButtons("Dehumidifier");
    showAppMessage("Choose from what room.");
  }

  async function handleDehumidifierReassignRoomClick(areaId) {
    const area = allAreas.find(function(item) {
      return item.id === areaId;
    });

    if (!area) {
      showAppMessage("Room not found.");
      return;
    }

    if (dehumidifierReassignStep === "from") {
      dehumidifierFromAreaId = area.id;
      dehumidifierReassignStep = "to";
      drawAdminAreaButtons("Dehumidifier");
      showDehumidifierMoveToInput();
      return;
    }

    if (dehumidifierReassignStep === "to") {
      showDehumidifierMoveToInput();
    }
  }

  function showDehumidifierMoveToInput() {
    const fromArea = allAreas.find(function(item) {
      return item.id === dehumidifierFromAreaId;
    });

    if (!fromArea) {
      dehumidifierReassignStep = "from";
      dehumidifierFromAreaId = "";
      drawAdminAreaButtons("Dehumidifier");
      showAppMessage("Choose from what room.");
      return;
    }

    showAppInputConfirmMessage(
      "Move dehumi " + fromArea.areaName + " to what room?",
      async function(toRoom) {
        await moveDehumidifierToRoom(fromArea, toRoom);
      },
      function() {
        dehumidifierReassignStep = "from";
        dehumidifierFromAreaId = "";
        drawAdminAreaButtons("Dehumidifier");
      }
    );
  }

  /* =========================
     24 - SEARCH AREAS
  ========================== */

  function searchAdminAreas() {
    adminAreaSearchTerm = document.getElementById("adminAreaSearchInput").value.trim();
    drawAdminAreaButtons(selectedCategory);
  }

  function setAdminAreaSearchVisibility(category) {
    const searchBox = document.getElementById("adminAreaSearchInput");
    if (category === "Weekly Room" || category === "Weekly Laundry" || category === "Dehumidifier") {
      searchBox.classList.remove("hidden");
    } else {
      searchBox.classList.add("hidden");
    }
  }

  function getDefaultTasksForSelectedCategory() {
    if (selectedCategory === "Weekly Room") return DEFAULT_WEEKLY_ROOM_TASKS;
    if (selectedCategory === "Daily Room") return DEFAULT_DAILY_ROOM_TASKS;
    if (selectedCategory === "Weekly Laundry") return ["Laundry Service"];
    if (selectedCategory === "Daily Laundry") return ["Laundry Service"];
    if (selectedCategory === "Dehumidifier") return getDefaultDehumidifierTasks();
    return [];
  }

  function getDefaultDehumidifierTasks() {
    return [
      "Empty Dehumidifier 8 AM",
      "Empty Dehumidifier 2 PM",
      "AM Filter",
      "PM Filter"
    ];
  }

  function getAllTaskNameSuggestions() {
    return [...new Set(allSubTasks.map(function(task) {
      return String(task.taskName || "").trim();
    }).filter(function(name) {
      return name !== "";
    }))].sort(function(a, b) {
      return a.localeCompare(b);
    });
  }

  function getSuggestedTasksForSelectedCategory() {
    const defaultTasks = getDefaultTasksForSelectedCategory();

    if (selectedCategory === "Dehumidifier") {
      return defaultTasks;
    }

    const allNames = getAllTaskNameSuggestions();
    return [...new Set(defaultTasks.concat(allNames))];
  }

  function setAdminBulkTaskBoxVisibility(category) {
    const box = document.getElementById("adminBulkTaskBox");
    const toggleButton = document.getElementById("adminBulkTaskToggleButton");
    const allowed = ["Weekly Room", "Daily Room", "Weekly Laundry", "Daily Laundry"].includes(category);

    if (!allowed) {
      adminBulkTaskOpen = false;
      if (box) box.classList.add("hidden");
      if (toggleButton) toggleButton.classList.add("hidden");
      return;
    }

    drawTaskCheckboxes("adminBulkTaskChecks", getDefaultTasksForSelectedCategory(), "bulkTaskCheck");

    if (toggleButton) {
      toggleButton.innerText = adminBulkTaskOpen ? "HIDE TASKS" : "TASK TOOLS";
      toggleButton.classList.remove("hidden");
    }

    if (box) {
      box.classList.toggle("hidden", !adminBulkTaskOpen);
    }
  }

  function toggleAdminBulkTaskBox() {
    adminBulkTaskOpen = !adminBulkTaskOpen;
    setAdminBulkTaskBoxVisibility(selectedCategory);
  }

  function setAdminSingleTaskBoxVisibility(category) {
    const box = document.getElementById("adminSingleTaskBox");
    const title = box.querySelector("h3");
    let taskList = getSuggestedTasksForSelectedCategory();
    const searchText = String(adminAreaTaskSearchTerm || "").trim().toLowerCase();

    if (searchText) {
      taskList = taskList.filter(function(taskName) {
        return String(taskName || "").toLowerCase().includes(searchText);
      });
    }

    if (taskList.length > 0 || searchText) {
      if (title) title.innerText = "Add Tasks";
      drawTaskCheckboxes("adminSingleTaskChecks", taskList, "singleTaskCheck");
      box.classList.remove("hidden");
    } else {
      box.classList.add("hidden");
    }
  }

  function searchAdminAreaTasks() {
    const input = document.getElementById("adminAreaTaskSearchInput");
    adminAreaTaskSearchTerm = input ? input.value.trim() : "";
    setAdminSingleTaskBoxVisibility(selectedCategory);
    drawAdminSubTaskButtons();
  }

  function drawTaskCheckboxes(containerId, taskList, className) {
    const box = document.getElementById(containerId);
    box.innerHTML = "";

    if (taskList.length === 0) {
      const empty = document.createElement("h3");
      empty.innerText = "No matching tasks.";
      box.appendChild(empty);
      return;
    }

    taskList.forEach(function(taskName) {
      const label = document.createElement("label");
      label.className = "check-item";
      label.innerHTML =
        '<input type="checkbox" class="' + className + '" value="' + escapeHtml(taskName) + '">' +
        '<span>' + escapeHtml(taskName) + '</span>';
      box.appendChild(label);
    });
  }

  function getCheckedTaskNames(className) {
    return Array.from(document.querySelectorAll("." + className + ":checked"))
      .map(function(input) { return input.value; });
  }

  function getScheduleForSingleTask() {
    if (isWeeklyCategory(selectedCategory)) return selectedAreaScheduleDay || currentWorkDayName;
    return "daily";
  }


  function getTaskCreateData(area, taskName) {
    return {
      areaId: area.workId || area.areaId || area.id,
      areaName: area.areaName || selectedArea,
      areaSearch: String(area.areaName || selectedArea || "").toLowerCase(),
      taskName: taskName,
      taskSearch: String(taskName || "").toLowerCase(),
      category: area.category || selectedCategory,
      categoryKey: makeId(area.category || selectedCategory),
      day: area.scheduleDay || area.day || getScheduleForSingleTask(),
      schedule: area.schedule || getAreaAssignment(area) || currentAssignment,
      modeType: area.modeType || getModeTypeForAssignment(area.schedule || currentAssignment),
      modeLabel: area.schedule || currentAssignment,
      floor: area.floor || getFloorForAssignment(area.schedule || currentAssignment),
      laundryType: area.laundryType || "",
      time: "",
      sourceSheet: "admin",
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
  }

  /* =========================
     26 - ADD / DELETE CHECKED TASKS TO ALL AREAS
  ========================== */

  async function addCheckedTasksToAllAreas() {
    const checkedTasks = getCheckedTaskNames("bulkTaskCheck");
    if (checkedTasks.length === 0) {
      showAppMessage("Select tasks.", "Tasks");
      return;
    }

    const areas = allAreasForAssignment.filter(function(area) {
      return area.category === selectedCategory && (isWeeklyCategory(selectedCategory)
        ? String(area.scheduleDay || "").trim().toLowerCase() === currentWorkDayName.toLowerCase()
        : isAreaForCurrentDay(area));
    });

    if (areas.length === 0) {
      showAppMessage("No rooms found.", "Tasks");
      return;
    }

    const ok = await showAppConfirmMessage("Add checked tasks to all " + areas.length + " areas? Duplicates will be skipped.", "Tasks");
    if (!ok) return;

    showLoading();
    let addedCount = 0;

    for (let a = 0; a < areas.length; a++) {
      const area = areas[a];

      for (let t = 0; t < checkedTasks.length; t++) {
        const taskName = checkedTasks[t];
        const exists = allSubTasks.some(function(task) {
          return task.workId === area.workId && String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
        });

        if (!exists) {
          await addDoc(collection(db, "tasks"), getTaskCreateData(area, taskName));
          addedCount++;
        }
      }
    }

    await loadAdminTasks();
    drawAdminAreaButtons(selectedCategory);
    hideLoading();
    showAppMessage("Added " + addedCount + " missing tasks.", "Tasks");
  }

  async function deleteCheckedTasksFromAllAreas() {
    const checkedTasks = getCheckedTaskNames("bulkTaskCheck");
    if (checkedTasks.length === 0) {
      showAppMessage("Select tasks.", "Tasks");
      return;
    }

    const checkedLower = checkedTasks.map(function(taskName) {
      return String(taskName || "").trim().toLowerCase();
    });

    const areas = allAreasForAssignment.filter(function(area) {
      return area.category === selectedCategory && (isWeeklyCategory(selectedCategory)
        ? String(area.scheduleDay || "").trim().toLowerCase() === currentWorkDayName.toLowerCase()
        : isAreaForCurrentDay(area));
    });

    const areaWorkIds = areas.map(function(area) { return area.workId; });

    const tasksToDelete = allSubTasks.filter(function(task) {
      return areaWorkIds.includes(task.workId) && checkedLower.includes(String(task.taskName || "").trim().toLowerCase());
    });

    if (tasksToDelete.length === 0) {
      showAppMessage("No matching tasks found.", "Tasks");
      return;
    }

    const ok = await showAppConfirmMessage("Delete " + tasksToDelete.length + " matching tasks?", "Tasks");
    if (!ok) return;

    showLoading();

    for (let i = 0; i < tasksToDelete.length; i++) {
      await deleteDoc(doc(db, "tasks", tasksToDelete[i].id));
    }

    await loadAdminTasks();
    drawAdminAreaButtons(selectedCategory);
    hideLoading();
    showAppMessage("Deleted " + tasksToDelete.length + " tasks.", "Tasks");
  }

  /* =========================
     27 - ADD / DELETE CHECKED TASKS TO SINGLE AREA
  ========================== */

  async function addCheckedTasksToSingleArea() {
    const checkedTasks = getCheckedTaskNames("singleTaskCheck");
    if (checkedTasks.length === 0) {
      showAppMessage("Select tasks.", "Tasks");
      return;
    }

    const saved = await ensureCurrentAreaSaved();
    if (!saved) return;

    showLoading();
    let addedCount = 0;

    for (let i = 0; i < checkedTasks.length; i++) {
      const taskName = checkedTasks[i];
      const exists = allSubTasks.some(function(task) {
        return task.workId === selectedAreaWorkId && String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
      });

      if (!exists) {
        await addDoc(collection(db, "tasks"), getTaskCreateData({
          workId: selectedAreaWorkId,
          areaId: selectedAreaWorkId,
          areaName: selectedArea,
          category: selectedCategory,
          scheduleDay: selectedAreaScheduleDay,
          day: selectedAreaScheduleDay,
          schedule: currentAssignment,
          modeType: getModeTypeForAssignment(currentAssignment),
          floor: getFloorForAssignment(currentAssignment)
        }, taskName));
        addedCount++;
      }
    }

    await loadAdminTasks();
    openAdminAreaTasks();
    hideLoading();
    const messageBox = document.getElementById("adminTaskMessage");
    if (messageBox) messageBox.innerText = "Added " + addedCount + " missing tasks.";
  }

  async function deleteCheckedTasksFromSingleArea() {
    const checkedTasks = getCheckedTaskNames("singleTaskCheck");
    if (checkedTasks.length === 0) {
      showAppMessage("Select tasks.", "Tasks");
      return;
    }

    const checkedLower = checkedTasks.map(function(taskName) {
      return String(taskName || "").trim().toLowerCase();
    });

    const tasksToDelete = currentAreaTasks.filter(function(task) {
      return checkedLower.includes(String(task.taskName || "").trim().toLowerCase());
    });

    if (tasksToDelete.length === 0) {
      showAppMessage("No matching tasks found.", "Tasks");
      return;
    }

    const ok = await showAppConfirmMessage("Delete " + tasksToDelete.length + " matching tasks from this area?", "Tasks");
    if (!ok) return;

    showLoading();

    for (let i = 0; i < tasksToDelete.length; i++) {
      await deleteDoc(doc(db, "tasks", tasksToDelete[i].id));
    }

    await loadAdminTasks();
    openAdminAreaTasks();
    hideLoading();
    const messageBox = document.getElementById("adminTaskMessage");
    if (messageBox) messageBox.innerText = "Deleted " + tasksToDelete.length + " tasks.";
  }

  /* =========================
     28 - AREA VIEW NUMBER LABEL
  ========================== */

  function setAdminAreaViewTag(category) {
    const tag = document.getElementById("adminAreaViewTag");
    if (category === "Common Area") tag.innerText = "ADMIN VIEW 3";
    else if (category === "Weekly Room") tag.innerText = "ADMIN VIEW 4";
    else if (category === "Daily Room") tag.innerText = "ADMIN VIEW 5";
    else if (category === "Dehumidifier") tag.innerText = "ADMIN VIEW 6";
    else if (category === "Weekly Laundry") tag.innerText = "ADMIN VIEW 4";
    else if (category === "Daily Laundry") tag.innerText = "ADMIN VIEW 5";
    else tag.innerText = "ADMIN VIEW 3";
  }

  /* =========================
     29 - WEEKLY DATE PICKER VISIBILITY
  ========================== */

  function setAdminAreaDatePickerVisibility(category) {
    const pickerBox = document.getElementById("adminAreaBigDatePickerBox");
    const dateTitle = document.getElementById("adminAreaDateTitle");

    if (isWeeklyCategory(category)) {
      pickerBox.classList.remove("hidden");
      dateTitle.classList.remove("hidden");
      updateAdminAreaDayButtons();
    } else {
      pickerBox.classList.add("hidden");
      dateTitle.classList.add("hidden");
    }
  }

  /* =========================
     29B - AREA EDITOR DISPLAY MODE
  ========================== */

  function setAdminAreaEditorMode(isDehumidifierEditor) {
    const assignmentLabel = document.getElementById("adminEditAssignmentLabel");
    const assignmentInput = document.getElementById("adminEditAssignmentInput");
    const areaInput = document.getElementById("adminEditAreaInput");
    const saveButton = document.getElementById("adminSaveAreaButton");
    const taskButton = document.getElementById("openAreaTasksButton");
    const deleteButton = document.getElementById("deleteAreaButton");
    const backButton = document.getElementById("adminEditBackButton");
    const saveRow = saveButton ? saveButton.parentElement : null;
    const deleteRow = deleteButton ? deleteButton.parentElement : null;
    const isNewDehumidifier = isDehumidifierEditor && !selectedAreaDocId;

    if (assignmentLabel) assignmentLabel.classList.toggle("hidden", isDehumidifierEditor);
    if (assignmentInput) assignmentInput.classList.toggle("hidden", isDehumidifierEditor);
    if (taskButton) taskButton.classList.toggle("hidden", isDehumidifierEditor);

    if (areaInput) {
      if (isDehumidifierEditor) {
        areaInput.setAttribute("inputmode", "numeric");
        areaInput.setAttribute("maxlength", "3");
        areaInput.setAttribute("pattern", "[0-9]*");
        areaInput.placeholder = "Room number";
        areaInput.oninput = function() {
          limitRoomInput(this);
        };
      } else {
        areaInput.removeAttribute("inputmode");
        areaInput.removeAttribute("maxlength");
        areaInput.removeAttribute("pattern");
        areaInput.placeholder = "";
        areaInput.oninput = null;
      }
    }

    if (saveButton) saveButton.innerText = isDehumidifierEditor ? "SAVE" : "SAVE AREA";
    if (deleteButton) {
      deleteButton.innerText = isDehumidifierEditor ? "DELETE" : "DELETE AREA";
      deleteButton.classList.toggle("hidden", isNewDehumidifier);
    }
    if (backButton) backButton.innerText = isNewDehumidifier ? "CANCEL" : "BACK";

    if (isDehumidifierEditor) {
      if (saveRow && deleteButton && !isNewDehumidifier && deleteButton.parentElement !== saveRow) {
        saveRow.appendChild(deleteButton);
      }
      if (saveRow && backButton && isNewDehumidifier && backButton.parentElement !== saveRow) {
        saveRow.appendChild(backButton);
      }
      if (deleteRow && backButton && !isNewDehumidifier && backButton.parentElement !== deleteRow) {
        deleteRow.appendChild(backButton);
      }
    } else {
      if (saveRow && taskButton && taskButton.parentElement !== saveRow) {
        saveRow.appendChild(taskButton);
      }
      if (deleteRow && deleteButton && deleteButton.parentElement !== deleteRow) {
        deleteRow.insertBefore(deleteButton, deleteRow.firstChild);
      }
      if (deleteRow && backButton && backButton.parentElement !== deleteRow) {
        deleteRow.appendChild(backButton);
      }
    }
  }

  /* =========================
     30 - OPEN EXISTING AREA EDITOR
  ========================== */

  function openAdminEditArea(areaId) {
    const area = allAreas.find(function(item) { return item.id === areaId; });

    if (!area) {
      showAppMessage("Area not found.", "Area");
      return;
    }

    selectedArea = area.areaName;
    selectedAreaDocId = area.id;
    selectedAreaWorkId = area.workId;
    selectedAreaScheduleDay = isWeeklyCategory(area.category) ? area.scheduleDay : "daily";
    selectedCategory = area.category;
    currentAreaTasks = getTasksForWorkId(area.workId);

    document.getElementById("adminEditTitle").innerText = area.areaName;
    document.getElementById("adminEditAreaInput").value = area.areaName;
    document.getElementById("adminEditAssignmentInput").value = getAreaAssignment(area) || currentAssignment;
    document.getElementById("adminEditCategoryInput").value = area.category;
    document.getElementById("adminAreaScheduleInput").value = selectedAreaScheduleDay;
    document.getElementById("adminMessage").innerText = "";

    updateAssignmentTitles();
    setAreaScheduleBoxVisibility();
    setAdminSingleTaskBoxVisibility(selectedCategory);
    closeAdminSubTaskEditor(true);
    drawAdminSubTaskButtons();
    setAdminAreaEditorMode(selectedCategory === "Dehumidifier");
    document.getElementById("openAreaTasksButton").classList.toggle("hidden", selectedCategory === "Dehumidifier");
    showAdminView("adminEditView");
  }

  /* =========================
     31 - OPEN NEW AREA EDITOR
  ========================== */

  function openNewAdminArea() {
    selectedArea = "";
    selectedAreaDocId = "";
    selectedAreaWorkId = "";
    currentAreaTasks = [];
    selectedAreaScheduleDay = isWeeklyCategory(selectedCategory) ? currentWorkDayName : "daily";

    document.getElementById("adminEditTitle").innerText =
      document.getElementById("adminEditTitle").innerText =
  selectedCategory === "Dehumidifier" ? "Add New Dehumidifier" : "New Area";
    document.getElementById("adminEditAreaInput").value = "";
    document.getElementById("adminEditAssignmentInput").value =
      selectedCategory === "Dehumidifier" ? "" : currentAssignment;
    document.getElementById("adminEditCategoryInput").value = selectedCategory;
    document.getElementById("adminAreaScheduleInput").value = selectedAreaScheduleDay;
    document.getElementById("adminMessage").innerText = "";

    updateAssignmentTitles();
    setAreaScheduleBoxVisibility();
    setAdminSingleTaskBoxVisibility(selectedCategory);
    closeAdminSubTaskEditor();
    drawAdminSubTaskButtons();
    setAdminAreaEditorMode(selectedCategory === "Dehumidifier");
    document.getElementById("openAreaTasksButton").classList.add("hidden");
    showAdminView("adminEditView");
  }

  /* =========================
     32 - AREA SCHEDULE DAY
  ========================== */

  function setAreaScheduleBoxVisibility() {
    const box = document.getElementById("adminAreaScheduleBox");
    const deleteButton = document.getElementById("deleteAreaButton");

    if (isWeeklyCategory(selectedCategory)) {
      box.classList.remove("hidden");
      deleteButton.innerText = "DELETE " + String(selectedAreaScheduleDay || currentWorkDayName || "DAY").toUpperCase();
    } else {
      box.classList.add("hidden");
      deleteButton.innerText = "DELETE AREA";
    }
  }

  function changeAdminAreaScheduleDay() {
    selectedAreaScheduleDay = document.getElementById("adminAreaScheduleInput").value;
    setAreaScheduleBoxVisibility();
    closeAdminSubTaskEditor();
    drawAdminSubTaskButtons();
  }

  /* =========================
     33 - DRAW TASK BUTTONS
  ========================== */

  function drawAdminSubTaskButtons() {
    const box = document.getElementById("adminSubtaskButtons");
    box.innerHTML = "";

    const searchText = String(adminAreaTaskSearchTerm || "").trim().toLowerCase();

    currentAreaTasks.forEach(function(task, index) {
      if (searchText && !String(task.taskName || "").toLowerCase().includes(searchText)) return;

      const btn = document.createElement("button");
      btn.className = "red";
      btn.innerHTML =
        '<div class="room-number">' + escapeHtml(task.taskName || "Task") + '</div>' +
        '<div class="room-counter">' + escapeHtml(selectedAreaScheduleDay || "daily") + '</div>';

      btn.onclick = function() {
        openAdminSubTaskEditor(index);
      };

      box.appendChild(btn);
    });

    if (box.innerHTML === "") {
      const empty = document.createElement("h3");
      empty.innerText = searchText ? "No matching tasks." : "No tasks yet.";
      box.appendChild(empty);
    }
  }

  /* =========================
     34 - OPEN TASK EDITOR
  ========================== */

  function openAdminSubTaskEditor(index) {
    const task = currentAreaTasks[index];
    if (!task) return;

    currentEditingTaskIndex = index;
    currentEditingTaskId = task.id || "";
    originalEditingTaskName = task.taskName || "";

    document.getElementById("adminSubtaskViewTag").innerText = "ADMIN VIEW 7-2";
    document.getElementById("adminSubtaskEditorTitle").innerText = "Edit Task";
    document.getElementById("adminTaskNameInput").value = task.taskName || "";
    document.getElementById("adminTaskScheduleInput").value = selectedAreaScheduleDay || "daily";

    setSaveAllWeeklyButtonVisibility();
    setTaskScheduleBoxVisibility();
    updateAssignmentTitles();
    document.getElementById("adminSubtaskEditor").classList.remove("hidden");
  }

  /* =========================
     35 - OPEN NEW TASK
  ========================== */

  function openNewAdminSubTask() {
    currentEditingTaskIndex = -1;
    currentEditingTaskId = "";
    originalEditingTaskName = "";

    document.getElementById("adminSubtaskViewTag").innerText = "ADMIN VIEW 7-2";
    document.getElementById("adminSubtaskEditorTitle").innerText = "New Task";
    document.getElementById("adminTaskNameInput").value = "";
    document.getElementById("adminTaskScheduleInput").value = selectedAreaScheduleDay || "daily";

    setSaveAllWeeklyButtonVisibility();
    setTaskScheduleBoxVisibility();
    updateAssignmentTitles();
    document.getElementById("adminSubtaskEditor").classList.remove("hidden");
  }

  /* =========================
     36 - CLOSE TASK EDITOR
  ========================== */

  function closeAdminSubTaskEditor() {
    currentEditingTaskIndex = -1;
    currentEditingTaskId = "";
    originalEditingTaskName = "";
    document.getElementById("adminSubtaskEditor").classList.add("hidden");
  }


  function cancelAdminSubTaskEditor() {
    if (returnToScheduleIfNeeded()) return;
    closeAdminSubTaskEditor();
  }
  function openAdminAreaTasks() {
    if (!selectedAreaDocId) {
      showAppMessage("Save area first.", "Tasks");
      return;
    }

    const area = allAreas.find(function(item) { return item.id === selectedAreaDocId; });

    if (area) {
      selectedArea = area.areaName;
      selectedAreaWorkId = area.workId;
      selectedAreaScheduleDay = isWeeklyCategory(area.category) ? area.scheduleDay : "daily";
      selectedCategory = area.category;
      currentAreaTasks = getTasksForWorkId(area.workId);
    }

    document.getElementById("adminAreaTasksTitle").innerText = selectedArea + " Tasks";
    document.getElementById("adminMessage").innerText = "";
    adminAreaTaskSearchTerm = "";
    const taskSearchInput = document.getElementById("adminAreaTaskSearchInput");
    if (taskSearchInput) taskSearchInput.value = "";
    const taskMessage = document.getElementById("adminTaskMessage");
    if (taskMessage) taskMessage.innerText = "";

    updateAssignmentTitles();
    setAdminSingleTaskBoxVisibility(selectedCategory);
    closeAdminSubTaskEditor();
    drawAdminSubTaskButtons();
    showAdminView("adminAreaTaskView");
  }

  function backToAdminAreaEdit() {
    if (returnToScheduleIfNeeded()) return;
    closeAdminSubTaskEditor();
    showAdminView("adminEditView");
  }

  /* =========================
     37 - SAVE ALL WEEKLY BUTTON VISIBILITY
  ========================== */

  function setSaveAllWeeklyButtonVisibility() {
    const btn = document.getElementById("saveAllWeeklyButton");
    if (isWeeklyCategory(selectedCategory)) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  }

  function setTaskScheduleBoxVisibility() {
    const box = document.getElementById("adminTaskScheduleBox");
    if (isWeeklyCategory(selectedCategory)) box.classList.remove("hidden");
    else box.classList.add("hidden");
  }

  /* =========================
     38 - SAVE AREA ONLY
  ========================== */

  async function ensureCurrentAreaSaved() {
    adminAreaSaveRedirectedToExisting = false;
    const areaName = document.getElementById("adminEditAreaInput").value.trim();
    let assignment = document.getElementById("adminEditAssignmentInput").value.trim();
    const category = document.getElementById("adminEditCategoryInput").value.trim();
    const scheduleDay = isWeeklyCategory(category)
      ? document.getElementById("adminAreaScheduleInput").value.trim()
      : "daily";

    if (category === "Dehumidifier" && areaName) {
      assignment = getDehumidifierAssignmentForRoom(areaName);
      document.getElementById("adminEditAssignmentInput").value = assignment;
    }

    if (!areaName) {
      await showAppConfirmMessage("Fill room number.");
      return false;
    }

    if (category === "Dehumidifier" && !/^\d{3}$/.test(areaName)) {
      await showAppConfirmMessage("Enter 3 digits.");
      return false;
    }

    if (!category) {
      await showAppConfirmMessage("Missing category.");
      return false;
    }

    if (!assignment) {
      await showAppConfirmMessage("Missing schedule.");
      return false;
    }

    if (isWeeklyCategory(category) && !scheduleDay) {
      await showAppConfirmMessage("Select schedule day.");
      return false;
    }

    if (category === "Daily Room") {
      const roomKey = getRoomKey(areaName || "");
      const weeklyBaseArea = roomKey
        ? allAreas.find(function(area) {
            return getAreaAssignment(area) === assignment &&
              area.category === "Weekly Room" &&
              getRoomKey(area.areaName || "") === roomKey;
          })
        : null;

      if (weeklyBaseArea) {
        const settingRef = doc(db, "room_settings", makeId(assignment + "_" + roomKey));
        const updatedSetting = {
          roomKey: roomKey,
          roomName: weeklyBaseArea.areaName || areaName,
          schedule: assignment,
          isDaily: true,
          updatedAt: serverTimestamp()
        };

        await setDoc(settingRef, updatedSetting, { merge: true });
        roomSettingsData[roomKey] = {
          ...(roomSettingsData[roomKey] || {}),
          ...updatedSetting
        };

        adminAreaSaveRedirectedToExisting = true;
        selectedArea = weeklyBaseArea.areaName || areaName;
        currentAssignment = assignment;
        selectedCategory = "Weekly Room";
        selectedAreaDocId = weeklyBaseArea.id;
        selectedAreaWorkId = weeklyBaseArea.workId;
        selectedAreaScheduleDay = weeklyBaseArea.scheduleDay || weeklyBaseArea.day || "";
        document.getElementById("adminAssignmentSelect").value = assignment;
        return true;
      }
    }

    const newWorkId = buildWorkId(areaName, category, scheduleDay, assignment);
    const oldWorkId = selectedAreaWorkId;

    const data = getAreaUpdateData(areaName, assignment, category, scheduleDay, newWorkId);

    if (selectedAreaDocId) {
      await updateDoc(doc(db, "areas", selectedAreaDocId), data);

      if (oldWorkId && oldWorkId !== newWorkId) {
        const tasksToMove = allSubTasks.filter(function(task) {
          return task.workId === oldWorkId;
        });

        for (let i = 0; i < tasksToMove.length; i++) {
          await updateDoc(doc(db, "tasks", tasksToMove[i].id), {
            areaId: newWorkId,
            workId: newWorkId,
            areaName: areaName,
            areaSearch: String(areaName || "").toLowerCase(),
            category: category,
            categoryKey: makeId(category),
            day: scheduleDay,
            schedule: assignment,
            modeType: getModeTypeForAssignment(assignment),
            floor: getFloorForAssignment(assignment),
            updatedAt: serverTimestamp()
          });
        }
      }
    } else {
      const newDoc = await addDoc(collection(db, "areas"), {
        ...data,
        createdAt: serverTimestamp()
      });
      selectedAreaDocId = newDoc.id;
    }

    selectedArea = areaName;
    currentAssignment = assignment;
    selectedCategory = category;
    selectedAreaScheduleDay = scheduleDay;
    selectedAreaWorkId = newWorkId;
    document.getElementById("adminAssignmentSelect").value = assignment;
    return true;
  }

  async function ensureDefaultDehumidifierTasksForCurrentArea() {
    if (selectedCategory !== "Dehumidifier" || !selectedAreaWorkId) return;

    const defaultTasks = getDefaultDehumidifierTasks();

    for (let i = 0; i < defaultTasks.length; i++) {
      const taskName = defaultTasks[i];
      const exists = allSubTasks.some(function(task) {
        return task.workId === selectedAreaWorkId &&
          String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
      });

      if (!exists) {
        await addDoc(collection(db, "tasks"), getTaskCreateData({
          workId: selectedAreaWorkId,
          areaId: selectedAreaWorkId,
          areaName: selectedArea,
          category: selectedCategory,
          scheduleDay: selectedAreaScheduleDay,
          day: selectedAreaScheduleDay,
          schedule: currentAssignment,
          modeType: getModeTypeForAssignment(currentAssignment),
          floor: getFloorForAssignment(currentAssignment)
        }, taskName));
      }
    }
  }

  async function saveAdminAreaOnly() {
    const wasNewArea = !selectedAreaDocId;

    showLoading();
    const saved = await ensureCurrentAreaSaved();
    if (!saved) {
      hideLoading();
      return;
    }

    if (selectedCategory === "Dehumidifier") {
      await loadAdminTasks();
      await ensureDefaultDehumidifierTasksForCurrentArea();
    }

    await loadAdminTasks();
    openAdminEditArea(selectedAreaDocId);
    hideLoading();

    if (returnToScheduleIfNeeded()) return;

    if (wasNewArea && selectedCategory !== "Dehumidifier" && !adminAreaSaveRedirectedToExisting) {
      const addTasksNow = await showAppConfirmMessage("Area saved. Add tasks now?");
      if (addTasksNow) {
        openAdminAreaTasks();
        return;
      }
    }

    document.getElementById("adminMessage").innerText = "Saved.";
  }

  /* =========================
     39 - SAVE TASK
  ========================== */

  async function saveAdminSubTask() {
    const taskName = document.getElementById("adminTaskNameInput").value.trim();

    if (!taskName) {
      showAppMessage("Fill task name.", "Tasks");
      return;
    }

    showLoading();

    const saved = await ensureCurrentAreaSaved();
    if (!saved) {
      hideLoading();
      return;
    }

    if (currentEditingTaskId) {
      await updateDoc(doc(db, "tasks", currentEditingTaskId), {
        areaId: selectedAreaWorkId,
        workId: selectedAreaWorkId,
        areaName: selectedArea,
        areaSearch: String(selectedArea || "").toLowerCase(),
        taskName: taskName,
        taskSearch: String(taskName || "").toLowerCase(),
        category: selectedCategory,
        categoryKey: makeId(selectedCategory),
        day: selectedAreaScheduleDay,
        schedule: currentAssignment,
        modeType: getModeTypeForAssignment(currentAssignment),
        floor: getFloorForAssignment(currentAssignment),
        active: true,
        updatedAt: serverTimestamp()
      });
    } else {
      const exists = allSubTasks.some(function(task) {
        return task.workId === selectedAreaWorkId && String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
      });

      if (!exists) {
        await addDoc(collection(db, "tasks"), getTaskCreateData({
          workId: selectedAreaWorkId,
          areaId: selectedAreaWorkId,
          areaName: selectedArea,
          category: selectedCategory,
          scheduleDay: selectedAreaScheduleDay,
          day: selectedAreaScheduleDay,
          schedule: currentAssignment,
          modeType: getModeTypeForAssignment(currentAssignment),
          floor: getFloorForAssignment(currentAssignment)
        }, taskName));
      }
    }

    await loadAdminTasks();
    openAdminAreaTasks();
    hideLoading();
    if (returnToScheduleIfNeeded()) return;
    document.getElementById("adminMessage").innerText = "Saved.";
  }

  /* =========================
     40 - SAVE TASK TO ALL WEEKLY ROOMS
  ========================== */

  async function saveAdminSubTaskToAllWeeklyRooms() {
    const assignment = document.getElementById("adminEditAssignmentInput").value.trim();
    const category = document.getElementById("adminEditCategoryInput").value.trim();
    const taskName = document.getElementById("adminTaskNameInput").value.trim();
    const schedule = document.getElementById("adminTaskScheduleInput").value.trim();

    if (!assignment || !category || !taskName || !schedule) {
      showAppMessage("Fill assignment, task name, and schedule day.", "Tasks");
      return;
    }

    const areas = allAreas.filter(function(area) {
      return getAreaAssignment(area) === assignment &&
        area.category === category &&
        String(area.scheduleDay || "").trim().toLowerCase() === schedule.toLowerCase();
    });

    if (areas.length === 0) {
      showAppMessage("No weekly rooms found for this day.", "Tasks");
      return;
    }

    const ok = await showAppConfirmMessage("Save this task to all " + areas.length + " weekly rooms for " + schedule + "?", "Tasks");
    if (!ok) return;

    showLoading();

    for (let i = 0; i < areas.length; i++) {
      const area = areas[i];

      let existingTask = null;

      if (originalEditingTaskName) {
        existingTask = allSubTasks.find(function(task) {
          return task.workId === area.workId &&
            String(task.taskName || "").trim().toLowerCase() === originalEditingTaskName.toLowerCase();
        });
      }

      if (!existingTask) {
        existingTask = allSubTasks.find(function(task) {
          return task.workId === area.workId &&
            String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
        });
      }

      if (existingTask) {
        await updateDoc(doc(db, "tasks", existingTask.id), {
          taskName: taskName,
          taskSearch: String(taskName || "").toLowerCase(),
          active: true,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, "tasks"), getTaskCreateData(area, taskName));
      }
    }

    await loadAdminTasks();
    if (selectedAreaDocId) openAdminAreaTasks();
    hideLoading();
    if (returnToScheduleIfNeeded()) return;
    document.getElementById("adminMessage").innerText = "Saved to all rooms for " + schedule + ".";
  }

  /* =========================
     41 - DELETE TASK
  ========================== */

  async function deleteAdminSubTask() {
    if (!currentEditingTaskId) {
      closeAdminSubTaskEditor();
      return;
    }

    const ok = confirm("Delete this task?");
    if (!ok) return;

    showLoading();
    await deleteDoc(doc(db, "tasks", currentEditingTaskId));
    await loadAdminTasks();
    if (selectedAreaDocId) openAdminAreaTasks();
    else showAdminView("adminAreaView");
    hideLoading();
    if (returnToScheduleIfNeeded()) return;
  }

  /* =========================
     42 - DELETE WHOLE AREA / DAY
  ========================== */

  async function deleteAdminArea() {
    if (!selectedAreaDocId) {
      backToAdminAreas();
      return;
    }

    const dailyDeleteRoomKey = getRoomKey(selectedArea || "");
    const dailyDeleteAssignment = document.getElementById("adminEditAssignmentInput").value.trim() || currentAssignment;
    const dailyDeleteWeeklyBase = dailyDeleteRoomKey
      ? allAreas.find(function(area) {
          return getAreaAssignment(area) === dailyDeleteAssignment &&
            area.category === "Weekly Room" &&
            getRoomKey(area.areaName || "") === dailyDeleteRoomKey;
        })
      : null;
    const dailyDeleteSetting = roomSettingsData[dailyDeleteAssignment + "|" + dailyDeleteRoomKey] || roomSettingsData[dailyDeleteRoomKey] || {};

    if (
      dailyDeleteRoomKey &&
      dailyDeleteWeeklyBase &&
      (selectedCategory === "Daily Room" || dailyDeleteSetting.isDaily === true)
    ) {
      const okDaily = confirm("Remove Daily label from room " + selectedArea + "?");
      if (!okDaily) return;

      showLoading();

      const settingRef = doc(db, "room_settings", makeId(dailyDeleteAssignment + "_" + dailyDeleteRoomKey));

      await setDoc(settingRef, {
        roomKey: dailyDeleteRoomKey,
        roomName: dailyDeleteWeeklyBase.areaName || selectedArea,
        schedule: dailyDeleteAssignment,
        isDaily: false,
        updatedAt: serverTimestamp()
      }, { merge: true });

      const updatedSetting = {
        ...dailyDeleteSetting,
        roomKey: dailyDeleteRoomKey,
        roomName: dailyDeleteWeeklyBase.areaName || selectedArea,
        schedule: dailyDeleteAssignment,
        isDaily: false
      };

      roomSettingsData[dailyDeleteAssignment + "|" + dailyDeleteRoomKey] = updatedSetting;

      if (dailyDeleteAssignment === String(currentAssignment || "")) {
        roomSettingsData[dailyDeleteRoomKey] = updatedSetting;
      }

      await loadAdminTasks();
      adminAreaOpenedFromDailyRoomAccess = false;
      selectedCategory = "Daily Room";
      drawAdminAreaButtons("Daily Room");
      showAdminView("adminAreaView");
      hideLoading();
      if (returnToScheduleIfNeeded()) return;
      return;
    }

    if (isWeeklyCategory(selectedCategory)) {
      const choice = prompt(
        "Delete room " + selectedArea + "?\n\n" +
        "Type 1 = delete room " + selectedArea + " from " + selectedAreaScheduleDay + " only\n" +
        "Type 2 = delete room " + selectedArea + " from every day in selected schedule only\n" +
        "Leave blank = cancel"
      );

      if (choice !== "1" && choice !== "2") return;

      if (choice === "1") {
        const okSingle = confirm(
          "Delete room " + selectedArea +
          " from " + selectedAreaScheduleDay + " only?"
        );

        if (!okSingle) return;

        showLoading();

        const tasksToDelete = getTasksForWorkId(selectedAreaWorkId);

        for (let i = 0; i < tasksToDelete.length; i++) {
          await deleteDoc(doc(db, "tasks", tasksToDelete[i].id));
        }

        await deleteDoc(doc(db, "areas", selectedAreaDocId));
      }

      if (choice === "2") {
        const okAll = confirm(
          "Delete room " + selectedArea +
          " from every " + selectedCategory +
          " day in " + currentAssignment + "?"
        );

        if (!okAll) return;

        showLoading();

        const matchingAreas = allAreas.filter(function(area) {
          return area.category === selectedCategory &&
            getAreaAssignment(area) === currentAssignment &&
            String(area.areaName || "").trim().toLowerCase() === String(selectedArea || "").trim().toLowerCase();
        });

        for (let a = 0; a < matchingAreas.length; a++) {
          const area = matchingAreas[a];
          const tasksToDelete = getTasksForWorkId(area.workId);

          for (let t = 0; t < tasksToDelete.length; t++) {
            await deleteDoc(doc(db, "tasks", tasksToDelete[t].id));
          }

          await deleteDoc(doc(db, "areas", area.id));
        }
      }

      await loadAdminTasks();
      drawAdminAreaButtons(selectedCategory);
      showAdminView("adminAreaView");
      hideLoading();
      if (returnToScheduleIfNeeded()) return;
      return;
    }

    const ok = confirm("Delete this whole area and all tasks?");
    if (!ok) return;

    showLoading();

    const tasksToDelete = getTasksForWorkId(selectedAreaWorkId);

    for (let i = 0; i < tasksToDelete.length; i++) {
      await deleteDoc(doc(db, "tasks", tasksToDelete[i].id));
    }

    await deleteDoc(doc(db, "areas", selectedAreaDocId));
    await loadAdminTasks();
    drawAdminAreaButtons(selectedCategory);
    showAdminView("adminAreaView");
    hideLoading();
    if (returnToScheduleIfNeeded()) return;
  }

  /* =========================
     43 - BACK BUTTONS
  ========================== */

  async function backToAdminAreas() {
    if (returnToScheduleIfNeeded()) return;
    await loadAdminTasks();
    drawAdminAreaButtons(selectedCategory);
    showAdminView("adminAreaView");
  }

  function backToAdminCategories() {
    if (returnToScheduleIfNeeded()) return;
    if (sessionStorage.getItem("employeeAccessDashboard") === "true") {
      selectedCategory = "";
      openEmployeeAccessDashboard();
      return;
    }

    selectedCategory = "";
    drawAdminCategories();

    if (adminScheduleEditorFlowActive) {
      updateScheduleChoiceTitle();
      showAdminView(currentAssignment ? "adminScheduleChoiceView" : "adminScheduleEditorView");
      return;
    }

    showAdminView("adminView2");
  }

  /* =========================
     43B - ROOM REPORT
  ========================== */


  function openReportChooser() {
    if (!requirePermission("reports")) return;
    pendingReportType = "daily";
    openDailyReportHome(currentWorkDateISO || getTodayISO());
  }

  function selectReportType(type) {
    pendingReportType = type === "daily" ? "daily" : "operational";
    openReportDateChoice();
  }

  function openReportDateChoice() {
    const title = document.getElementById("reportFlowTitle");
    const text = document.getElementById("reportFlowText");
    const dateBox = document.getElementById("reportFlowDateBox");
    const datePicker = document.getElementById("reportFlowDatePicker");
    const actions = document.getElementById("reportFlowActions");

    if (title) title.innerText = "Choose Date";
    if (text) text.innerText = "Use today or another day?";
    if (dateBox) dateBox.classList.add("hidden");
    if (datePicker) datePicker.value = getTodayISO();
    if (actions) {
      actions.className = "app-message-actions";
      actions.innerHTML =
        '<button type="button" class="green" onclick="useReportToday()">TODAY</button>' +
        '<button type="button" onclick="showReportOtherDate()">ANOTHER DAY</button>' +
        '<button type="button" class="back" onclick="closeReportFlowPopup()">CANCEL</button>';
    }
  }

  function useReportToday() {
    openSelectedReportWithDate(getTodayISO());
  }

  function showReportOtherDate() {
    const text = document.getElementById("reportFlowText");
    const dateBox = document.getElementById("reportFlowDateBox");
    const datePicker = document.getElementById("reportFlowDatePicker");
    const actions = document.getElementById("reportFlowActions");

    if (text) text.innerText = "Pick date.";
    if (dateBox) dateBox.classList.remove("hidden");
    if (datePicker && !datePicker.value) datePicker.value = getTodayISO();
    if (actions) {
      actions.className = "app-message-actions";
      actions.innerHTML =
        '<button type="button" class="green" onclick="continueReportOtherDate()">CONTINUE</button>' +
        '<button type="button" class="back" onclick="openReportDateChoice()">BACK</button>';
    }
  }

  function continueReportOtherDate() {
    const datePicker = document.getElementById("reportFlowDatePicker");
    const selectedDate = datePicker && datePicker.value ? datePicker.value : getTodayISO();
    openSelectedReportWithDate(selectedDate);
  }

  function openSelectedReportWithDate(selectedDate) {
    currentWorkDateISO = selectedDate || getTodayISO();
    updateDateDisplay();
    closeReportFlowPopup();

    if (pendingReportType === "daily") {
      openDailyReportHome(currentWorkDateISO);
      return;
    }

    openOperationalReportHome(currentWorkDateISO);
  }

  function closeReportFlowPopup() {
    const box = document.getElementById("reportFlowBox");
    if (box) box.classList.add("hidden");
  }

  function handleReportRoomAutoInput(input, type) {
    limitRoomInput(input);
    const roomNumber = String(input ? input.value : "").replace(/\D/g, "").slice(0, 3);

    if (roomNumber.length !== 3) return;

    if (type === "daily") {
      openDailyReport(roomNumber);
      return;
    }

    openRoomReport(roomNumber);
  }

  function openOperationalReportHome(selectedDate) {
    currentRoomReportNumber = "";
    currentRoomReportAreas = [];
    currentRoomReportStatuses = [];
    currentRoomReportIssues = [];

    const searchInput = document.getElementById("roomReportSearchInput");
    const picker = document.getElementById("roomReportDatePicker");
    const box = document.getElementById("roomReportSingleCardList");

    if (searchInput) searchInput.value = "";
    if (picker) picker.value = selectedDate || currentWorkDateISO;
    if (box) box.innerHTML = '<div class="room-report-card"><h3 class="room-report-main-title">Operational Report</h3><div class="room-report-line">Search a room to build the report.</div></div>';

    showAdminView("adminRoomReportView");
    setTimeout(function() { if (searchInput) searchInput.focus(); }, 50);
  }

  function openDailyReportHome(selectedDate) {
    currentRoomReportNumber = "";
    currentRoomReportAreas = [];
    currentRoomReportStatuses = [];
    currentRoomReportIssues = [];

    const searchInput = document.getElementById("dailyReportSearchInput");
    const picker = document.getElementById("dailyReportDatePicker");
    const box = document.getElementById("dailyReportCardList");

    if (searchInput) searchInput.value = "";
    if (picker) picker.value = selectedDate || currentWorkDateISO;
    if (box) box.innerHTML = '<div class="daily-report-card"><div class="daily-report-card-title">Room / Area Report</div><div class="daily-report-line">Search a room to build the report.</div></div>';

    showAdminView("adminDailyReportView");
    setTimeout(function() { if (searchInput) searchInput.focus(); }, 50);
  }

  function handleAdminRoomSearchKey(event) {
    if (event && event.key === "Enter") {
      event.preventDefault();
      openAdminRoomReportFromSearch();
    }
  }

  async function openAdminRoomReportFromSearch() {
    const input = document.getElementById("adminRoomSearchInput");
    const roomNumber = String(input ? input.value : "").replace(/\D/g, "").slice(0, 3);

    if (!roomNumber) {
      showAppMessage("Enter room number.");
      return;
    }

    await openRoomReport(roomNumber);
  }

  function handleRoomReportSearchKey(event) {
    if (event && event.key === "Enter") {
      event.preventDefault();
      openRoomReportFromReportSearch();
    }
  }

  async function openRoomReportFromReportSearch() {
    const input = document.getElementById("roomReportSearchInput");
    const roomNumber = String(input ? input.value : "").replace(/\D/g, "").slice(0, 3);

    if (!roomNumber) {
      showAppMessage("Enter room number.");
      return;
    }

    await openRoomReport(roomNumber);
  }

  async function openRoomReport(roomNumber) {
    currentRoomReportNumber = String(roomNumber || "").replace(/\D/g, "").slice(0, 3);

    if (!currentRoomReportNumber) {
      showAppMessage("Enter room number.");
      return;
    }

    if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAllAdminData();
    }

    currentRoomReportAreas = getRoomReportAreas(currentRoomReportNumber);

    const mainSearchInput = document.getElementById("adminRoomSearchInput");
    const reportSearchInput = document.getElementById("roomReportSearchInput");

    if (mainSearchInput) mainSearchInput.value = currentRoomReportNumber;
    if (reportSearchInput) reportSearchInput.value = currentRoomReportNumber;

    document.getElementById("roomReportDatePicker").value = currentWorkDateISO;

    await loadRoomReportSummary();

    showAdminView("adminRoomReportView");
  }

  function getRoomReportAreas(roomNumber) {
    const roomKey = getRoomKey(roomNumber);

    return allAreas
      .filter(function(area) {
        return getRoomKey(area.areaName) === roomKey;
      })
      .sort(function(a, b) {
        const scheduleCompare = String(getAreaAssignment(a) || "").localeCompare(String(getAreaAssignment(b) || ""));
        if (scheduleCompare !== 0) return scheduleCompare;

        const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
        if (categoryCompare !== 0) return categoryCompare;

        return String(a.scheduleDay || "").localeCompare(String(b.scheduleDay || ""));
      });
  }

  async function changeRoomReportDate() {
    drawRoomReportSingleCard();
  }

  async function loadRoomReportSummary() {
    showLoading();

    const statusSnap = await getDocs(collection(db, "task_area_status"));

    currentRoomReportStatuses = statusSnap.docs
      .map(function(statusDoc) {
        return {
          id: statusDoc.id,
          ...statusDoc.data()
        };
      })
      .filter(function(record) {
        return isRoomReportRecordMatch(record);
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });

    const issueSnap = await getDocs(collection(db, "issue_logs"));

    currentRoomReportIssues = issueSnap.docs
      .map(function(issueDoc) {
        return {
          id: issueDoc.id,
          ...issueDoc.data()
        };
      })
      .filter(function(issue) {
        return isRoomReportRecordMatch(issue);
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });

    drawRoomReportSingleCard();
    hideLoading();
  }

  function isRoomReportRecordMatch(record) {
    const roomKey = getRoomKey(currentRoomReportNumber);
    const areaIds = currentRoomReportAreas.map(function(area) {
      return String(area.workId || area.areaId || area.id || "");
    });
    const recordRoomKey = getReportRecordRoomKey(record);

    if (areaIds.includes(String(record.areaId || ""))) {
      return true;
    }

    if (areaIds.includes(String(record.workId || ""))) {
      return true;
    }

    if (getRoomKey(record.areaName) === roomKey) {
      return true;
    }

    if (recordRoomKey && recordRoomKey === roomKey) {
      return true;
    }

    if (isReportRecordIdForRoom(record, roomKey)) {
      return true;
    }

    return false;
  }

  function getReportRecordRoomKey(record) {
    const fields = [
      record.roomKey,
      record.roomNumber,
      record.roomNo,
      record.room,
      record.roomName,
      record.areaName,
      record.locationName,
      record.location
    ];

    for (let i = 0; i < fields.length; i++) {
      const key = getRoomKey(fields[i]);
      if (key) return key;
    }

    return "";
  }

  function isReportRecordIdForRoom(record, roomKey) {
    const values = [
      record.id,
      record.statusId,
      record.statusKey,
      record.areaId,
      record.workId,
      record.taskAreaId
    ];

    return values.some(function(value) {
      return reportTextContainsRoomKey(value, roomKey);
    });
  }

  function reportTextContainsRoomKey(value, roomKey) {
    const cleanRoomKey = String(roomKey || "").trim().toLowerCase();
    if (!cleanRoomKey) return false;

    const tokens = String(value || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(function(token) { return token !== ""; });

    return tokens.includes(cleanRoomKey);
  }

  function drawRoomReportSingleCard() {
    const box = document.getElementById("roomReportSingleCardList");
    const picker = document.getElementById("roomReportDatePicker");
    const selectedDate = picker && picker.value ? picker.value : currentWorkDateISO;

    box.innerHTML = "";

    const card = document.createElement("div");
    card.className = "room-report-card";

    const residentStatus = getRoomResidentStatus();
    const laundryScheduleHtml = buildRoomScheduleSettingsHtml("laundry");
    const housekeepingScheduleHtml = buildRoomScheduleSettingsHtml("housekeeping");
    const dehumidifierScheduleHtml = buildRoomScheduleSettingsHtml("dehumidifier");
    const hasDehumidifierSetup = currentRoomReportAreas.some(function(area) {
      return String(area.category || "") === "Dehumidifier";
    });

    const lastHousekeeping = getLastRoomStatus(function(record) {
      return isHousekeepingStatus(record);
    });
    const lastLaundry = getLastRoomStatus(function(record) {
      return isLaundryStatus(record);
    });
    const lastDehumidifierAm = getLastRoomStatus(function(record) {
      return isDehumidifierStatus(record) && getDehumidifierPeriod(record) === "AM";
    });
    const lastDehumidifierPm = getLastRoomStatus(function(record) {
      return isDehumidifierStatus(record) && getDehumidifierPeriod(record) === "PM";
    });

    const openIssues = currentRoomReportIssues.filter(function(issue) {
      const status = String(issue.status || "Open");
      return status === "Open" || status === "Needs Follow-Up";
    });

    const selectedDateStatuses = currentRoomReportStatuses.filter(function(record) {
      return getRecordDateISO(record) === selectedDate;
    });

    const selectedDateIssues = currentRoomReportIssues.filter(function(issue) {
      return getRecordDateISO(issue) === selectedDate;
    });

    card.innerHTML =
      '<h3 class="room-report-main-title">01 - ROOM ' + escapeHtml(currentRoomReportNumber) + '</h3>' +
      '<div class="room-report-line">Resident Status: ' + escapeHtml(residentStatus) + '</div>' +
      '<div class="room-report-section-title">02 - Laundry Schedule</div>' +
      laundryScheduleHtml +
      '<div class="room-report-section-title">03 - Last Laundry Executed</div>' +
      '<div class="room-report-line">' + escapeHtml(formatStatusSummary(lastLaundry)) + '</div>' +
      '<div class="room-report-section-title">04 - Housekeeping Schedule</div>' +
      housekeepingScheduleHtml +
      '<div class="room-report-section-title">05 - Last Housekeeping Executed</div>' +
      '<div class="room-report-line">' + escapeHtml(formatStatusSummary(lastHousekeeping)) + '</div>' +
      '<div class="room-report-section-title">06 - Dehumidifier</div>' +
      dehumidifierScheduleHtml +
      '<div class="room-report-section-title">07 - Last Dehumidifier Executed</div>' +
      buildDehumidifierExecutedHtml(hasDehumidifierSetup, lastDehumidifierAm, lastDehumidifierPm) +
      '<div class="room-report-section-title">08 - Open Issues</div>' +
      buildOpenIssuesHtml(openIssues) +
      '<div class="room-report-section-title">09 - Selected Date - ' + escapeHtml(formatDateWithWeekday(selectedDate)) + '</div>' +
      buildSelectedDateHtml(selectedDateStatuses, selectedDateIssues);

    box.appendChild(card);
  }

  function handleDailyReportSearchKey(event) {
    if (event && event.key === "Enter") {
      event.preventDefault();
      openDailyReportFromSearch();
    }
  }

  async function openDailyReportFromSearch() {
    const input = document.getElementById("dailyReportSearchInput");
    const roomNumber = String(input ? input.value : "").replace(/\D/g, "").slice(0, 3);

    if (!roomNumber) {
      showAppMessage("Enter room number.");
      return;
    }

    await openDailyReport(roomNumber);
  }

  async function openDailyReport(roomNumber) {
    currentRoomReportNumber = String(roomNumber || "").replace(/\D/g, "").slice(0, 3);

    if (!currentRoomReportNumber) {
      showAppMessage("Enter room number.");
      return;
    }

    if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAllAdminData();
    }

    currentRoomReportAreas = getRoomReportAreas(currentRoomReportNumber);

    const searchInput = document.getElementById("dailyReportSearchInput");
    if (searchInput) searchInput.value = currentRoomReportNumber;

    const picker = document.getElementById("dailyReportDatePicker");
    if (picker && !picker.value) picker.value = currentWorkDateISO;

    await loadDailyReportSummary();
    showAdminView("adminDailyReportView");
  }

  async function changeDailyReportDate() {
    if (!currentRoomReportNumber) return;
    await loadDailyReportSummary();
  }

  async function loadDailyReportSummary() {
    showLoading();

    const statusSnap = await getDocs(collection(db, "task_area_status"));

    currentRoomReportStatuses = statusSnap.docs
      .map(function(statusDoc) {
        return {
          id: statusDoc.id,
          ...statusDoc.data()
        };
      })
      .filter(function(record) {
        return isRoomReportRecordMatch(record);
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });

    const issueSnap = await getDocs(collection(db, "issue_logs"));

    currentRoomReportIssues = issueSnap.docs
      .map(function(issueDoc) {
        return {
          id: issueDoc.id,
          ...issueDoc.data()
        };
      })
      .filter(function(issue) {
        return isRoomReportRecordMatch(issue);
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });

    drawDailyReportCard();
    hideLoading();
  }

  function drawDailyReportCard() {
    const box = document.getElementById("dailyReportCardList");
    const picker = document.getElementById("dailyReportDatePicker");
    const selectedDate = picker && picker.value ? picker.value : currentWorkDateISO;

    if (!box) return;
    box.innerHTML = "";

    const title = document.createElement("div");
    title.innerHTML =
      '<div class="daily-report-mode">Active Mode: ' + escapeHtml(getDailyReportModeLabel()) + '</div>';
    box.appendChild(title);

    box.appendChild(buildDailyReportSection("Room Settings", buildDailyRoomSettingsHtml()));
    box.appendChild(buildDailyReportSection("Laundry", buildDailyCategoryHtml("Laundry", selectedDate)));
    box.appendChild(buildDailyReportSection("Housekeeping", buildDailyCategoryHtml("Housekeeping", selectedDate)));

    if (hasDailyReportDehumidifier()) {
      box.appendChild(buildDailyReportSection("Dehumidifier", buildDailyDehumidifierHtml(selectedDate)));
    }
  }

  function buildDailyReportSection(title, bodyHtml) {
    const card = document.createElement("div");
    card.className = "daily-report-card";
    card.innerHTML =
      '<div class="daily-report-card-title">' + escapeHtml(title) + '</div>' +
      bodyHtml;
    return card;
  }

  function getDailyReportModeLabel() {
    return housekeepingMode === "three" ? "Mode 3" : "Mode 2";
  }

  function buildDailyRoomSettingsHtml() {
    if (!isDailyReportDailyRoom()) {
      return '<div class="daily-report-line">N/A</div>';
    }

    const residentStatus = getRoomResidentStatus();
    const settingParts = [residentStatus, "Daily Room"];

    if (hasDailyReportDehumidifier()) {
      settingParts.push("Dehumidifier");
    } else {
      settingParts.push("No Dehumidifier");
    }

    return '<div class="daily-report-line">' + escapeHtml(settingParts.join(" · ")) + '</div>';
  }

  function isDailyReportDailyRoom() {
    const roomKey = getRoomKey(currentRoomReportNumber);

    if (currentRoomReportAreas.some(function(area) {
      return String(area.category || "") === "Daily Room";
    })) {
      return true;
    }

    return Object.keys(roomSettingsData || {}).some(function(key) {
      const setting = roomSettingsData[key] || {};
      return getRoomKey(setting.roomKey || setting.roomName || "") === roomKey && setting.isDaily === true;
    });
  }

  function hasDailyReportDehumidifier() {
    return currentRoomReportAreas.some(function(area) {
      return String(area.category || "") === "Dehumidifier";
    });
  }

  function buildDailyCategoryHtml(type, selectedDate) {
    let html = "";

    const weeklyRecords = getDailyReportRecords(type, "weekly", selectedDate);
    const dailyRecords = getDailyReportRecords(type, "daily", selectedDate);
    const weeklyAreas = getDailyReportAreas(type, "weekly");
    const dailyAreas = getDailyReportAreas(type, "daily");

    html += buildDailyScheduleBlock(
      getDailyReportWeeklyTitle(type, weeklyAreas),
      weeklyRecords[0] || null,
      type,
      selectedDate,
      "weekly"
    );

    html += buildDailyScheduleBlock(
      "Daily",
      dailyRecords[0] || null,
      type,
      selectedDate,
      "daily"
    );

    return html;
  }

  function buildDailyDehumidifierHtml(selectedDate) {
    const amRecords = currentRoomReportStatuses.filter(function(record) {
      return getRecordDateISO(record) === selectedDate && isDehumidifierStatus(record) && getDehumidifierPeriod(record) === "AM";
    });

    const pmRecords = currentRoomReportStatuses.filter(function(record) {
      return getRecordDateISO(record) === selectedDate && isDehumidifierStatus(record) && getDehumidifierPeriod(record) === "PM";
    });

    return buildDailyScheduleBlock("AM", amRecords[0] || null, "Dehumidifier", selectedDate, "am") +
      buildDailyScheduleBlock("PM", pmRecords[0] || null, "Dehumidifier", selectedDate, "pm");
  }

  function getDailyReportAreas(type, scheduleType) {
    return currentRoomReportAreas.filter(function(area) {
      const category = String(area.category || "");
      const schedule = String(getAreaAssignment(area) || "");

      if (type === "Laundry") {
        if (!(category.includes("Laundry") || schedule === "Laundry")) return false;
      } else if (type === "Housekeeping") {
        if (!["Weekly Room", "Daily Room"].includes(category)) return false;
      }

      if (scheduleType === "weekly") return isWeeklyCategory(category);
      return !isWeeklyCategory(category);
    });
  }

  function getDailyReportRecords(type, scheduleType, selectedDate) {
    const exactRecords = getDailyReportRecordsForDateMode(type, scheduleType, selectedDate, false);

    if (exactRecords.length > 0) {
      return exactRecords;
    }

    return getDailyReportRecordsForDateMode(type, scheduleType, selectedDate, true);
  }

  function getDailyReportRecordsForDateMode(type, scheduleType, selectedDate, allowWeekdayFallback) {
    return currentRoomReportStatuses
      .filter(function(record) {
        if (!isDailyReportRecordForSelectedDate(record, selectedDate, allowWeekdayFallback)) return false;
        if (!isDailyReportRecordTypeMatch(record, type, scheduleType)) return false;
        return true;
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });
  }

  function isDailyReportRecordTypeMatch(record, type, scheduleType) {
    if (type === "Laundry" && !isLaundryStatus(record)) return false;
    if (type === "Housekeeping" && !isHousekeepingStatus(record)) return false;

    const category = String(record.category || "");
    if (scheduleType === "weekly") return isWeeklyCategory(category);
    return !isWeeklyCategory(category);
  }

  function getDailyReportWeeklyTitle(type, weeklyAreas) {
    const firstArea = weeklyAreas[0] || null;
    const day = firstArea ? String(firstArea.scheduleDay || firstArea.day || "").trim() : "";
    return day ? "Weekly " + day : "Weekly";
  }

  function buildDailyScheduleBlock(title, record, type, selectedDate, scheduleType) {
    if (!record) {
      return '<div class="daily-report-block-title">' + escapeHtml(title) + '</div>' +
        '<div class="daily-report-line">No save found.</div>';
    }

    return '<div class="daily-report-block-title">' + escapeHtml(title) + '</div>' +
      '<div class="daily-report-line">Status: ' + escapeHtml(getDailyReportStatusLine(record)) + '</div>' +
      '<div class="daily-report-line">Saved: ' + escapeHtml(formatDailyReportDateTime(record)) + '</div>' +
      '<div class="daily-report-line">Completed by: ' + escapeHtml(record.employeeName || "Unknown") + '</div>' +
      buildDailyIncompleteTasksHtml(record) +
      buildDailyIssuesLine(type, selectedDate, scheduleType);
  }

  function getDailyReportStatusLine(record) {
    const completed = Number(record.completedCount || 0);
    const incomplete = Number(record.incompleteCount || 0);
    const total = Number(record.totalCount || completed + incomplete || 0);
    const statusText = incomplete > 0 ? "Incomplete" : "Complete";
    const countText = total > 0 ? " - " + completed + " of " + total + " done" : "";

    return statusText + countText;
  }

  function getDailyReportEmployeeLine(record) {
    return (record.employeeName || "Unknown") + " · " + formatDailyReportDateTime(record);
  }

  function formatDailyReportDateTime(record) {
    const isoDate = getRecordDateISO(record);
    const dateText = formatDailyDateWithWeekday(isoDate);
    const directTime = String(
      record.completedTime ||
      record.savedTime ||
      record.createdTime ||
      record.updatedTime ||
      record.timeCompleted ||
      record.time ||
      ""
    ).trim();

    if (directTime) return dateText + " at " + directTime;

    const millis = getTimestampMillis(record);
    if (!millis) return dateText;

    const timeText = new Date(millis).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

    return dateText + " at " + timeText;
  }

  function formatDailyDateWithWeekday(isoDate) {
    const cleanDate = String(isoDate || "").slice(0, 10);
    if (!cleanDate) return "No date";

    const parts = cleanDate.split("-");
    if (parts.length !== 3) return cleanDate;

    return getWeekdayName(cleanDate) + " " + parts[1] + "/" + parts[2] + "/" + parts[0];
  }

  function isDailyReportDoneBySchedule(record) {
    const recordDay = getWeekdayName(getRecordDateISO(record));
    const scheduleDay = String(record.scheduleDay || record.day || "").trim();

    if (!scheduleDay || scheduleDay.toLowerCase() === "daily") return true;
    return scheduleDay.toLowerCase() === recordDay.toLowerCase();
  }

  function isDailyReportDoneInTime(record) {
    return isDailyReportDoneBySchedule(record);
  }

  function buildDailyIncompleteTasksHtml(record) {
    const tasks = getDailyIncompleteTasks(record);

    if (tasks.length === 0) {
      return '<div class="daily-report-line">Incomplete Tasks / Issues: None</div>';
    }

    let html = '<div class="daily-report-line">Incomplete Tasks / Issues</div>';

    tasks.forEach(function(task) {
      html += '<div class="daily-report-line">- ' + escapeHtml(task.taskName + ': ' + task.reason) + '</div>';
    });

    return html;
  }

  function getDailyIncompleteTasks(record) {
    const output = [];
    const seen = {};

    collectDailyIncompleteTasks(record.taskStatusByName || {}, output, seen);
    collectDailyIncompleteTasks(record.tasks || {}, output, seen);

    return output;
  }

  function collectDailyIncompleteTasks(taskMap, output, seen) {
    Object.keys(taskMap || {}).forEach(function(taskKey) {
      const task = taskMap[taskKey] || {};
      const status = String(task.status || "").trim().toLowerCase();

      if (status !== "incomplete") return;

      const taskName = String(task.taskName || task.name || taskKey || "Task").trim();
      const reason = String(task.reason || task.issueReason || task.note || task.notes || "Incomplete").trim();
      const uniqueKey = makeId(taskName);

      if (seen[uniqueKey]) return;

      seen[uniqueKey] = true;
      output.push({
        taskName: taskName,
        reason: reason || "Incomplete"
      });
    });
  }

  function buildDailyIssuesLine(type, selectedDate, scheduleType) {
    const issues = getDailyIssuesForBlock(type, selectedDate, scheduleType);

    if (issues.length === 0) {
      return "";
    }

    return '<button class="daily-report-issue-button" onclick="openIssuesForRoomCategory(\'' + escapeHtml(type) + '\')">OPEN ISSUES</button>';
  }

  function getDailyIssuesForBlock(type, selectedDate, scheduleType) {
    const exactIssues = getDailyIssuesForBlockDateMode(type, selectedDate, scheduleType, false);

    if (exactIssues.length > 0) {
      return exactIssues;
    }

    return getDailyIssuesForBlockDateMode(type, selectedDate, scheduleType, true);
  }

  function getDailyIssuesForBlockDateMode(type, selectedDate, scheduleType, allowWeekdayFallback) {
    return currentRoomReportIssues
      .filter(function(issue) {
        if (!isDailyReportRecordForSelectedDate(issue, selectedDate, allowWeekdayFallback)) return false;

        const category = String(issue.category || "");

        if (type === "Laundry") {
          if (!(category.includes("Laundry") || String(issue.schedule || "") === "Laundry")) return false;
        } else if (type === "Housekeeping") {
          if (!["Weekly Room", "Daily Room"].includes(category)) return false;
        } else if (type === "Dehumidifier") {
          if (!isDehumidifierStatus(issue)) return false;
        }

        if (scheduleType === "weekly") return isWeeklyCategory(category);
        if (scheduleType === "daily") return !isWeeklyCategory(category);
        if (scheduleType === "am") return getDehumidifierPeriod(issue) === "AM";
        if (scheduleType === "pm") return getDehumidifierPeriod(issue) === "PM";

        return true;
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      })
      .slice(0, 1);
  }

  function isDailyReportRecordForSelectedDate(record, selectedDate, allowWeekdayFallback) {
    const recordDate = getRecordDateISO(record);

    if (recordDate) {
      if (recordDate === selectedDate) return true;
      if (!allowWeekdayFallback) return false;
      return isDailyReportRecordForSelectedWeekday(record, selectedDate);
    }

    if (!allowWeekdayFallback) return false;

    return isDailyReportRecordForSelectedWeekday(record, selectedDate);
  }

  function isDailyReportRecordForSelectedWeekday(record, selectedDate) {
    const selectedDay = getWeekdayName(selectedDate).toLowerCase();
    const recordDay = getDailyReportRecordScheduleDay(record);

    return recordDay !== "" && recordDay === selectedDay;
  }

  function getDailyReportRecordScheduleDay(record) {
    const directDay = String(record.scheduleDay || record.day || "").trim().toLowerCase();

    if (directDay && directDay !== "daily") {
      return directDay;
    }

    const idText = [
      record.areaId,
      record.workId,
      record.statusId,
      record.id
    ].join("_").toLowerCase();

    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

    for (let i = 0; i < weekdays.length; i++) {
      if (idText.includes("_" + weekdays[i] + "_") || idText.includes("-" + weekdays[i] + "-")) {
        return weekdays[i];
      }
    }

    return String(record.weekday || "").trim().toLowerCase();
  }

  function getDailyIssueLabel(type) {
    if (type === "Laundry") return "Laundry Issues";
    if (type === "Dehumidifier") return "Dehum Issues";
    return "HK Issues";
  }

  async function openIssuesForRoomCategory(type) {
    const picker = document.getElementById("dailyReportDatePicker");
    const selectedDate = picker && picker.value ? picker.value : currentWorkDateISO;
    const roomKey = getRoomKey(currentRoomReportNumber);

    showLoading();

    const snap = await getDocs(collection(db, "issue_logs"));

    allIssues = snap.docs
      .map(function(issueDoc) {
        return {
          id: issueDoc.id,
          ...issueDoc.data()
        };
      })
      .filter(function(issue) {
        if (getRecordDateISO(issue) !== selectedDate) return false;
        const issueRoomKey = getReportRecordRoomKey(issue);
        if (issueRoomKey && issueRoomKey !== roomKey) return false;
        if (!issueRoomKey && getRoomKey(issue.areaName) !== roomKey) return false;

        const category = String(issue.category || "");

        if (type === "Laundry") return category.includes("Laundry") || String(issue.schedule || "") === "Laundry";
        if (type === "Dehumidifier") return isDehumidifierStatus(issue);
        return ["Weekly Room", "Daily Room"].includes(category);
      })
      .sort(function(a, b) {
        return getRecordSortValue(b) - getRecordSortValue(a);
      });

    const datePicker = document.getElementById("issueDatePicker");
    const statusFilter = document.getElementById("issueStatusFilter");
    const searchInput = document.getElementById("issueSearchInput");

    if (datePicker) datePicker.value = selectedDate;
    if (statusFilter) statusFilter.value = "All";
    if (searchInput) searchInput.value = currentRoomReportNumber;

    currentDailyReportIssueCategory = type;
    drawIssueList();
    hideLoading();
    updateAssignmentTitles();
    showAdminView("adminIssuesView");
  }

  function getRoomResidentStatus() {
    const statusFields = [
      "residentStatus",
      "roomStatus",
      "occupancyStatus",
      "occupancy",
      "residentState",
      "status"
    ];

    for (let i = 0; i < currentRoomReportAreas.length; i++) {
      const area = currentRoomReportAreas[i];

      for (let f = 0; f < statusFields.length; f++) {
        const value = String(area[statusFields[f]] || "").trim();
        const lower = value.toLowerCase();

        if (["vacant", "occupied", "hospital", "assisted"].includes(lower)) {
          return value;
        }
      }
    }

    const combined = currentRoomReportAreas.map(function(area) {
      return [
        area.areaName,
        area.category,
        area.notes,
        area.note,
        area.label,
        area.roomLabel,
        area.roomType
      ].join(" ");
    }).join(" ").toLowerCase();

    if (combined.includes("vacant")) return "Vacant";
    if (combined.includes("hospital")) return "Hospital";
    if (combined.includes("assisted")) return "Assisted";
    if (currentRoomReportAreas.length > 0) return "Occupied / Active";
    return "No active room setup";
  }

  function buildRoomActiveSettingsHtml() {
    if (currentRoomReportAreas.length === 0) {
      return '<div class="room-report-line">No active setup found for this room.</div>';
    }

    return buildRoomScheduleSettingsHtml("housekeeping") +
      buildRoomScheduleSettingsHtml("laundry") +
      buildRoomScheduleSettingsHtml("dehumidifier");
  }

  function buildRoomScheduleSettingsHtml(type) {
    if (type === "laundry") {
      return buildRoomSettingsForAreas(
        currentRoomReportAreas.filter(function(area) {
          return getAreaAssignment(area) === "Laundry" || String(area.category || "").includes("Laundry");
        }),
        "No laundry schedule found."
      );
    }

    if (type === "dehumidifier") {
      return buildRoomSettingsForAreas(
        currentRoomReportAreas.filter(function(area) {
          return String(area.category || "") === "Dehumidifier";
        }),
        "No dehumidifier found."
      );
    }

    let html = "";
    html += buildRoomModeSettingsGroup("MODE 2", ["HK1", "HK2"]);
    html += buildRoomModeSettingsGroup("MODE 3", ["1stfloor", "2ndFloor", "3rdFloor"]);
    return html || '<div class="room-report-line">No housekeeping schedule found.</div>';
  }

  function buildRoomModeSettingsGroup(title, schedules) {
    const areas = dedupeRoomReportHousekeepingAreas(currentRoomReportAreas.filter(function(area) {
      return schedules.includes(getAreaAssignment(area)) && String(area.category || "") !== "Dehumidifier";
    }));

    let html = '<div class="room-report-section-title">' + escapeHtml(title) + '</div>';

    if (areas.length === 0) {
      html += '<div class="room-report-line">No setup.</div>';
      return html;
    }

    return html + buildRoomSettingsForAreas(areas, "No setup.");
  }

  function dedupeRoomReportHousekeepingAreas(areas) {
    const output = [];
    const groups = {};

    areas.forEach(function(area) {
      const category = String(area.category || "");
      const roomKey = getRoomKey(area.areaName || "");
      const assignment = getAreaAssignment(area);
      const isRoomCategory = category === "Weekly Room" || category === "Daily Room";

      if (!isRoomCategory || !roomKey || !assignment) {
        output.push(area);
        return;
      }

      const groupKey = assignment + "|" + roomKey;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          roomKey: roomKey,
          rows: [],
          outputIndex: output.length
        };
        output.push(null);
      }

      groups[groupKey].rows.push(area);
    });

    Object.keys(groups).forEach(function(groupKey) {
      const group = groups[groupKey];
      const weeklyRows = group.rows.filter(function(area) { return area.category === "Weekly Room"; });
      const dailyRows = group.rows.filter(function(area) { return area.category === "Daily Room"; });

      if (weeklyRows.length > 0) {
        const weeklyBase = weeklyRows[0];
        const setting = roomSettingsData[groupKey] || roomSettingsData[group.roomKey] || {};
        const displayRows = [weeklyBase];

        if (setting.isDaily === true) {
          displayRows.push({
            ...weeklyBase,
            category: "Daily Room",
            scheduleDay: "daily",
            day: "daily"
          });
        }

        output[group.outputIndex] = displayRows;
        return;
      }

      output[group.outputIndex] = dailyRows;
    });

    return output.reduce(function(flattened, item) {
      if (Array.isArray(item)) return flattened.concat(item);
      if (item) flattened.push(item);
      return flattened;
    }, []);
  }

  function buildRoomSettingsForAreas(areas, emptyText) {
    if (!areas || areas.length === 0) {
      return '<div class="room-report-line">' + escapeHtml(emptyText || "No setup.") + '</div>';
    }

    let html = "";

    areas.forEach(function(area) {
      html += '<div class="room-report-line">' + escapeHtml(formatRoomSettingLine(area)) + '</div>';
    });

    return html;
  }

  function buildDehumidifierExecutedHtml(hasDehumidifierSetup, lastDehumidifierAm, lastDehumidifierPm) {
    if (!hasDehumidifierSetup) {
      return '<div class="room-report-line">No dehumidifier found.</div>';
    }

    return '<div class="room-report-line">AM: ' + escapeHtml(formatStatusSummary(lastDehumidifierAm)) + '</div>' +
      '<div class="room-report-line">PM: ' + escapeHtml(formatStatusSummary(lastDehumidifierPm)) + '</div>';
  }

  function formatRoomSettingLine(area) {
    const tasks = getTasksForWorkId(area.workId);
    const category = area.category || "Area";
    const schedule = getAreaAssignment(area) || "";
    const day = area.scheduleDay || area.day || "daily";
    const laundryType = area.laundryType ? " - " + area.laundryType : "";
    const taskText = tasks.length === 1 ? "1 task" : tasks.length + " tasks";

    if (String(category || "").includes("Laundry") || schedule === "Laundry") {
      return category + ": " + day + laundryType + " - " + taskText;
    }

    return category + ": " + schedule + " - " + day + laundryType + " - " + taskText;
  }

  function getLastRoomStatus(filterFunction) {
    return currentRoomReportStatuses.find(function(record) {
      return filterFunction(record);
    }) || null;
  }

  function isHousekeepingStatus(record) {
    return ["Weekly Room", "Daily Room"].includes(String(record.category || ""));
  }

  function isLaundryStatus(record) {
    const category = String(record.category || "");
    const schedule = String(record.schedule || "");
    return category.includes("Laundry") || schedule === "Laundry";
  }

  function isDehumidifierStatus(record) {
    return String(record.category || "") === "Dehumidifier" ||
      String(record.areaName || "").toLowerCase().includes("dehum") ||
      String(record.taskName || "").toLowerCase().includes("dehum");
  }

  function getDehumidifierPeriod(record) {
    const directValue = String(record.period || record.timePeriod || record.shift || record.amPm || record.ampm || record.time || "").toUpperCase();

    if (directValue.includes("AM")) return "AM";
    if (directValue.includes("PM")) return "PM";

    const tasks = record.tasks || {};
    const taskKeys = Object.keys(tasks);

    for (let i = 0; i < taskKeys.length; i++) {
      const task = tasks[taskKeys[i]] || {};
      const text = [task.taskName, task.period, task.time, task.status].join(" ").toUpperCase();

      if (text.includes("AM")) return "AM";
      if (text.includes("PM")) return "PM";
    }

    return "";
  }

  function formatStatusSummary(record) {
    if (!record) return "No record found";

    const completed = Number(record.completedCount || 0);
    const incomplete = Number(record.incompleteCount || 0);
    const total = Number(record.totalCount || completed + incomplete || 0);
    const statusLabel = incomplete > 0 ? "Not Done / Issue" : "Done";
    const countText = total > 0 ? " - " + completed + " of " + total + " done" : "";
    const employeeText = record.employeeName ? " - " + record.employeeName : "";
    const taskText = getRecordTaskLabel(record);

    return taskText + " - " + getRecordDateTimeText(record) + " - " + statusLabel + countText + employeeText;
  }

  function getRecordTaskLabel(record) {
    const category = String(record.category || "").trim();
    const taskName = String(record.taskName || "").trim();
    const period = getDehumidifierPeriod(record);

    if (category === "Dehumidifier" && period) {
      return "Dehumidifier " + period;
    }

    if (category) return category;
    if (taskName) return taskName;
    return "Task";
  }

  function buildOpenIssuesHtml(openIssues) {
    if (openIssues.length === 0) {
      return '<div class="room-report-line">No open issues.</div>';
    }

    let html = "";

    openIssues.forEach(function(issue) {
      const line = [
        issue.status || "Open",
        issue.taskName || "Issue",
        issue.issueReason || "",
        getRecordDateTimeText(issue),
        issue.followUpNote || issue.issueNote || ""
      ].filter(function(item) { return String(item || "").trim() !== ""; }).join(" - ");

      html += '<div class="room-report-line">' + escapeHtml(line) + '</div>';
    });

    return html;
  }

  function buildSelectedDateHtml(statuses, issues) {
    if (statuses.length === 0 && issues.length === 0) {
      return '<div class="room-report-line">No activity found for this date.</div>';
    }

    let html = "";

    statuses.forEach(function(record) {
      html += '<div class="room-report-line">' + escapeHtml(formatStatusSummary(record)) + '</div>';
    });

    issues.forEach(function(issue) {
      const line = [
        "Issue",
        issue.status || "Open",
        issue.taskName || "",
        issue.issueReason || "",
        getRecordDateTimeText(issue)
      ].filter(function(item) { return String(item || "").trim() !== ""; }).join(" - ");

      html += '<div class="room-report-line">' + escapeHtml(line) + '</div>';
    });

    return html;
  }

  function getRecordDateISO(record) {
    const directDate = String(record.workDateISO || record.completedDate || record.createdDate || record.date || "").slice(0, 10);

    if (directDate) return directDate;

    const millis = getTimestampMillis(record);
    if (!millis) return "";

    const date = new Date(millis);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");

    return yyyy + "-" + mm + "-" + dd;
  }

  function formatDateWithWeekday(isoDate) {
    const cleanDate = String(isoDate || "").slice(0, 10);

    if (!cleanDate) return "No date";

    return getWeekdayName(cleanDate) + " " + cleanDate;
  }

  function getRecordDateTimeText(record) {
    const dateText = formatDateWithWeekday(getRecordDateISO(record));
    const directTime = String(
      record.completedTime ||
      record.savedTime ||
      record.createdTime ||
      record.updatedTime ||
      record.timeCompleted ||
      record.time ||
      ""
    ).trim();

    if (directTime) return dateText + " - " + directTime;

    const millis = getTimestampMillis(record);
    if (!millis) return dateText;

    const timeText = new Date(millis).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

    return dateText + " - " + timeText;
  }

  function getTimestampMillis(record) {
    if (record.updatedAt && typeof record.updatedAt.toMillis === "function") {
      return record.updatedAt.toMillis();
    }

    if (record.createdAt && typeof record.createdAt.toMillis === "function") {
      return record.createdAt.toMillis();
    }

    if (record.completedAt && typeof record.completedAt.toMillis === "function") {
      return record.completedAt.toMillis();
    }

    return 0;
  }

  function getRecordSortValue(record) {
    const millis = getTimestampMillis(record);
    if (millis) return millis;

    const dateText = getRecordDateISO(record);
    const timeText = String(
      record.completedTime ||
      record.savedTime ||
      record.createdTime ||
      record.updatedTime ||
      record.timeCompleted ||
      record.time ||
      "00:00"
    ).trim();

    const parsed = Date.parse((dateText || "1900-01-01") + " " + timeText);
    if (!Number.isNaN(parsed)) return parsed;

    return 0;
  }

  function getRecordSortTime(record) {
    return getRecordSortValue(record);
  }


  /* =========================
     44 - OPEN EMPLOYEES
  ========================== */

  async function openEmployees() {
    if (!requirePermission("editEmployees")) return;
    showLoading();

    const snap = await getDocs(collection(db, "employees"));
    const employees = snap.docs.map(function(empDoc) {
      return { id: empDoc.id, ...empDoc.data() };
    });

    const box = document.getElementById("employeeList");
    box.innerHTML = "";

    employees.forEach(function(emp) {
      const btn = document.createElement("button");
      const name = ((emp.firstName || "") + " " + (emp.lastName || "")).trim() || emp.employeeName || emp.name || "Employee";

      btn.innerHTML =
        '<div class="room-number">' + escapeHtml(name) + '</div>' +
        '<div class="room-counter">PIN: ' + escapeHtml(emp.pin || "") + '</div>';

      btn.onclick = function() { openEmployeeEditor(emp); };
      box.appendChild(btn);
    });

    if (box.innerHTML === "") {
      const empty = document.createElement("h3");
      empty.innerText = "No employees found.";
      box.appendChild(empty);
    }

    hideLoading();
    updateAssignmentTitles();
    showAdminView("adminEmployeesView");
  }

  /* =========================
     44B - OPEN ISSUES
  ========================== */

  async function openIssues() {
    if (!requirePermission("issues")) return;
    document.getElementById("issueDatePicker").value = currentWorkDateISO;
    document.getElementById("issueStatusFilter").value = "Open";
    document.getElementById("issueSearchInput").value = "";

    await loadFilteredIssues();

    updateAssignmentTitles();
    showAdminView("adminIssuesView");
  }

  async function loadFilteredIssues() {
    showLoading();

    const picker = document.getElementById("issueDatePicker");
    const selectedDate = picker && picker.value ? picker.value : currentWorkDateISO;
    const statusFilter = document.getElementById("issueStatusFilter").value;

    currentWorkDateISO = selectedDate;
    updateDateDisplay();

    const issueQuery = query(
      collection(db, "issue_logs"),
      where("workDateISO", "==", selectedDate),
      where("schedule", "==", currentAssignment)
    );

    const snap = await getDocs(issueQuery);

    allIssues = snap.docs.map(function(issueDoc) {
      return {
        id: issueDoc.id,
        ...issueDoc.data()
      };
    });

    allIssues = allIssues.sort(function(a, b) {
      const aValue = String(a.createdDate || "") + " " + String(a.createdTime || "");
      const bValue = String(b.createdDate || "") + " " + String(b.createdTime || "");
      return bValue.localeCompare(aValue);
    });

    drawIssueList();

    hideLoading();
  }

  async function loadAllIssues() {
    const ok = confirm("Load every issue record?");
    if (!ok) return;

    showLoading();

    const snap = await getDocs(collection(db, "issue_logs"));

    allIssues = snap.docs.map(function(issueDoc) {
      return {
        id: issueDoc.id,
        ...issueDoc.data()
      };
    });

    allIssues = allIssues.sort(function(a, b) {
      const aValue = String(a.createdDate || "") + " " + String(a.createdTime || "");
      const bValue = String(b.createdDate || "") + " " + String(b.createdTime || "");
      return bValue.localeCompare(aValue);
    });

    document.getElementById("issueStatusFilter").value = "All";
    drawIssueList();

    hideLoading();
  }

  function drawIssueList() {
    const box = document.getElementById("issueList");
    const statusFilter = document.getElementById("issueStatusFilter").value;
    const searchText = String(document.getElementById("issueSearchInput").value || "").trim().toLowerCase();

    box.innerHTML = "";

    let issues = allIssues.filter(function(issue) {
      if (statusFilter !== "All" && String(issue.status || "Open") !== statusFilter) return false;

      if (searchText) {
        const combined = [
          issue.areaName,
          issue.employeeName,
          issue.category,
          issue.taskName,
          issue.issueReason,
          issue.issueNote,
          issue.status
        ].join(" ").toLowerCase();

        if (!combined.includes(searchText)) return false;
      }

      return true;
    });

    if (issues.length === 0) {
      const empty = document.createElement("h3");
      empty.innerText = "No issues found.";
      box.appendChild(empty);
      return;
    }

    issues.forEach(function(issue) {
      const card = document.createElement("div");
      card.className = "issue-card";

      const title = (issue.areaName || "Area") + " - " + (issue.taskName || "Task");
      const status = issue.status || "Open";
      const photos = Number(issue.photoCount || 0);

      card.innerHTML =
        '<h3>' + escapeHtml(title) + '</h3>' +
        '<div class="issue-line">Status: ' + escapeHtml(status) + '</div>' +
        '<div class="issue-line">Employee: ' + escapeHtml(issue.employeeName || "") + '</div>' +
        '<div class="issue-line">Date: ' + escapeHtml(issue.createdDate || "") + ' ' + escapeHtml(issue.createdTime || "") + '</div>' +
        '<div class="issue-line">Category: ' + escapeHtml(issue.category || "") + '</div>' +
        '<div class="issue-line">Reason: ' + escapeHtml(issue.issueReason || "") + '</div>' +
        '<div class="issue-line">Photos: ' + photos + '</div>' +
        '<div class="issue-note">' + escapeHtml(issue.issueNote || "") + '</div>' +
        '<label>Follow-Up Note</label>' +
        '<textarea id="followup_' + issue.id + '">' + escapeHtml(issue.followUpNote || "") + '</textarea>' +
        '<div class="button-row-three">' +
          '<button class="yellow" onclick="markIssueFollowUp(\'' + issue.id + '\')">FOLLOW UP</button>' +
          '<button class="green" onclick="resolveIssue(\'' + issue.id + '\')">RESOLVE</button>' +
          '<button class="red" onclick="deleteIssueLog(\'' + issue.id + '\')">DELETE</button>' +
        '</div>';

      box.appendChild(card);
    });
  }

  async function markIssueFollowUp(issueId) {
    const noteBox = document.getElementById("followup_" + issueId);
    const noteText = noteBox ? noteBox.value.trim() : "";

    showLoading();

    await updateDoc(doc(db, "issue_logs", issueId), {
      status: "Needs Follow-Up",
      needsFollowUp: true,
      followUpNote: noteText,
      lastUpdated: getDateTimeNow(),
      updatedAt: serverTimestamp()
    });

    await openIssues();
    hideLoading();
  }

  async function resolveIssue(issueId) {
    const noteBox = document.getElementById("followup_" + issueId);
    const noteText = noteBox ? noteBox.value.trim() : "";
    const issue = allIssues.find(function(item) {
      return item.id === issueId;
    });

    showLoading();

    await updateDoc(doc(db, "issue_logs", issueId), {
      status: "Resolved",
      needsFollowUp: false,
      followUpNote: noteText,
      resolvedBy: sessionData.name || sessionData.employeeName || "Admin",
      resolvedDate: getTodayISO(),
      lastUpdated: getDateTimeNow(),
      updatedAt: serverTimestamp()
    });

    if (issue) {
      await resolveLinkedAreaStatus(issue);
    }

    await openIssues();
    hideLoading();
  }

  async function deleteIssueLog(issueId) {
    const ok = confirm("Delete this issue?");
    if (!ok) return;

    showLoading();

    await updateDoc(doc(db, "issue_logs", issueId), {
      status: "Deleted",
      needsFollowUp: false,
      lastUpdated: getDateTimeNow(),
      updatedAt: serverTimestamp()
    });

    await openIssues();
    hideLoading();
  }

  async function resolveLinkedAreaStatus(issue) {
    const workDateISO = issue.workDateISO || issue.createdDate || "";
    const scheduleValue = issue.schedule || currentAssignment || "";

    if (!workDateISO) {
      return false;
    }

    const exactUpdated = await resolveExactStatusMatch(issue, workDateISO, scheduleValue);

    if (exactUpdated) {
      return true;
    }

    const statusQuery = query(
      collection(db, "task_area_status"),
      where("workDateISO", "==", workDateISO)
    );

    const snap = await getDocs(statusQuery);

    for (const statusDoc of snap.docs) {
      const statusData = statusDoc.data();

      if (!isStatusMatchForIssue(statusData, issue, scheduleValue)) {
        continue;
      }

      const updated = await updateStatusTasksForIssue(statusDoc.ref, statusData, issue);

      if (updated) {
        return true;
      }
    }

    return false;
  }

  async function resolveExactStatusMatch(issue, workDateISO, scheduleValue) {
    const employeeIdValue = issue.employeeId || "";
    const areaIdValue = issue.areaId || "";

    if (!workDateISO || !employeeIdValue || !scheduleValue || !areaIdValue) {
      return false;
    }

    const statusId = cleanStatusId([
      workDateISO,
      employeeIdValue,
      scheduleValue,
      areaIdValue
    ].join("_"));

    const statusRef = doc(db, "task_area_status", statusId);
    const statusSnap = await getDoc(statusRef);

    if (!statusSnap.exists()) {
      return false;
    }

    return await updateStatusTasksForIssue(statusRef, statusSnap.data(), issue);
  }

  function isStatusMatchForIssue(statusData, issue, scheduleValue) {
    const issueAreaId = String(issue.areaId || "").trim();
    const issueAreaName = normalizeText(issue.areaName || "");

    if (scheduleValue && String(statusData.schedule || "") !== scheduleValue) {
      return false;
    }

    if (issueAreaId && String(statusData.areaId || "") === issueAreaId) {
      return true;
    }

    if (issueAreaName && normalizeText(statusData.areaName || "") === issueAreaName) {
      return true;
    }

    return false;
  }

  async function updateStatusTasksForIssue(statusRef, statusData, issue) {
    const tasks = statusData.tasks || {};
    const taskKeys = Object.keys(tasks);
    let taskUpdated = false;

    taskKeys.forEach(function(taskKey) {
      if (taskUpdated) return;

      const task = tasks[taskKey] || {};
      const statusText = String(task.status || "").trim();
      const taskNameMatch =
        normalizeText(task.taskName || "") === normalizeText(issue.taskName || "");

      const taskIdMatch =
        issue.taskId &&
        String(task.taskId || taskKey) === String(issue.taskId);

      if (statusText === "Incomplete" && (taskIdMatch || taskNameMatch)) {
        tasks[taskKey] = {
          ...task,
          status: "Completed",
          reason: ""
        };

        taskUpdated = true;
      }
    });

    if (!taskUpdated) {
      const incompleteKeys = taskKeys.filter(function(taskKey) {
        return String((tasks[taskKey] || {}).status || "").trim() === "Incomplete";
      });

      if (incompleteKeys.length === 1) {
        const onlyKey = incompleteKeys[0];

        tasks[onlyKey] = {
          ...tasks[onlyKey],
          status: "Completed",
          reason: ""
        };

        taskUpdated = true;
      }
    }

    if (!taskUpdated) {
      return false;
    }

    const counts = getStatusCountsFromTasks(tasks);

    await updateDoc(statusRef, {
      tasks: tasks,
      completedCount: counts.completedCount,
      incompleteCount: counts.incompleteCount,
      totalCount: counts.totalCount,
      status: counts.incompleteCount > 0 ? "Incomplete" : "Completed",
      updatedAt: serverTimestamp()
    });

    return true;
  }

  function getStatusCountsFromTasks(tasks) {
    const keys = Object.keys(tasks);
    let completedCount = 0;
    let incompleteCount = 0;

    keys.forEach(function(taskKey) {
      const status = String((tasks[taskKey] || {}).status || "").trim();

      if (status === "Completed") completedCount++;
      else if (status === "Incomplete") incompleteCount++;
    });

    return {
      completedCount: completedCount,
      incompleteCount: incompleteCount,
      totalCount: keys.length
    };
  }

  async function syncResolvedIssuesToAreaStatus() {
    const resolvedIssues = allIssues.filter(function(issue) {
      return String(issue.status || "") === "Resolved";
    });

    for (const issue of resolvedIssues) {
      await resolveLinkedAreaStatus(issue);
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function cleanStatusId(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .replace(/_+/g, "_") || "blank";
  }

  function getDateTimeNow() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const time = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });

    return yyyy + "-" + mm + "-" + dd + " " + time;
  }


  /* =========================
     44B - ROOM SAFE CHECK
  ========================== */

  const ROOM_SAFE_ASSIGNMENTS = ["HK1", "HK2", "1stfloor", "2ndFloor", "3rdFloor"];
  const ROOM_SAFE_MODE_2_ASSIGNMENTS = ["HK1", "HK2"];
  const ROOM_SAFE_MODE_3_ASSIGNMENTS = ["1stfloor", "2ndFloor", "3rdFloor"];
  const ROOM_SAFE_DAILY_MASTER_BY_ASSIGNMENT = {
    HK1: ["103", "201", "205", "211", "219", "229"]
  };



  /* =========================
     43C - ROOM / AREA QUICK TOOLS
  ========================== */

  let quickToolsFloor = "1";
  let quickToolsSelectedType = "";
  let quickToolsSelectedValue = "";
  let quickToolsSelectedAreaId = "";

  async function openQuickToolsView() {
    if (allAreas.length === 0 || allSubTasks.length === 0) {
      await loadAllAdminData();
    }

    quickToolsFloor = "1";
    clearQuickToolsSelection();

    const roomInput = document.getElementById("quickToolsRoomSearchInput");
    if (roomInput) roomInput.value = "";

    fillQuickToolsAreaDropdown();
    updateQuickToolsFloorButtons();
    drawQuickToolsChoices();
    showAdminView("adminQuickToolsView");
  }

  function setQuickToolsFloor(floor) {
    quickToolsFloor = floor === "areas" ? "areas" : String(floor || "1");
    clearQuickToolsSelection();

    const roomInput = document.getElementById("quickToolsRoomSearchInput");
    const areaSelect = document.getElementById("quickToolsAreaSelect");
    if (roomInput) roomInput.value = "";
    if (areaSelect) areaSelect.value = "";

    updateQuickToolsFloorButtons();
    drawQuickToolsChoices();
  }

  function updateQuickToolsFloorButtons() {
    ["1", "2", "3"].forEach(function(floor) {
      const btn = document.getElementById("quickToolsFloor" + floor + "Button");
      if (btn) btn.classList.toggle("active-quick-floor", quickToolsFloor === floor);
    });

    const areaButton = document.getElementById("quickToolsAreasButton");
    if (areaButton) areaButton.classList.toggle("active-quick-floor", quickToolsFloor === "areas");

    const roomBox = document.getElementById("quickToolsRoomSearchBox");
    const areaBox = document.getElementById("quickToolsAreaSearchBox");
    if (roomBox) roomBox.classList.toggle("hidden", quickToolsFloor === "areas");
    if (areaBox) areaBox.classList.toggle("hidden", quickToolsFloor !== "areas");
  }

  function handleQuickToolsRoomSearch() {
    const input = document.getElementById("quickToolsRoomSearchInput");
    if (input) input.value = String(input.value || "").replace(/\D/g, "").slice(0, 3);
    clearQuickToolsSelection();
    drawQuickToolsChoices();
  }

  function fillQuickToolsAreaDropdown() {
    const select = document.getElementById("quickToolsAreaSelect");
    if (!select) return;

    const choices = getQuickToolsAreaChoices();
    select.innerHTML = '<option value="">Choose existing area</option>';

    choices.forEach(function(choice) {
      const option = document.createElement("option");
      option.value = choice.value;
      option.innerText = choice.label;
      select.appendChild(option);
    });
  }

  function getQuickToolsAreaChoices() {
    const groups = {};

    allAreas.forEach(function(area) {
      const areaName = String(area.areaName || "").trim();
      if (!areaName) return;
      if (/^\d{3,4}$/.test(areaName)) return;

      const groupKey = areaName.toLowerCase();
      if (!groups[groupKey]) {
        groups[groupKey] = {
          areaName: areaName,
          areaId: area.id,
          schedules: []
        };
      }

      const schedule = getAreaAssignment(area);
      if (schedule && !groups[groupKey].schedules.includes(schedule)) {
        groups[groupKey].schedules.push(schedule);
      }
    });

    return Object.keys(groups).map(function(groupKey) {
      const item = groups[groupKey];
      const scheduleLabel = item.schedules.length ? " - " + item.schedules.join(", ") : "";
      return {
        value: item.areaName,
        label: item.areaName + scheduleLabel,
        areaId: item.areaId
      };
    }).sort(function(a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });
    });
  }

  function selectQuickToolsAreaFromDropdown() {
    const select = document.getElementById("quickToolsAreaSelect");
    const value = String(select ? select.value : "").trim();

    if (!value) {
      clearQuickToolsSelection();
      return;
    }

    const match = allAreas.find(function(area) {
      return String(area.areaName || "").trim().toLowerCase() === value.toLowerCase();
    });

    selectQuickToolsItem("area", value, match ? match.id : "");
  }

  function drawQuickToolsChoices() {
    const box = document.getElementById("quickToolsRoomButtons");
    if (!box) return;

    box.innerHTML = "";

    if (quickToolsFloor === "areas") {
      return;
    }

    const roomInput = document.getElementById("quickToolsRoomSearchInput");
    const searchValue = String(roomInput ? roomInput.value : "").replace(/\D/g, "");
    const rooms = getQuickToolsRoomsForFloor(quickToolsFloor).filter(function(room) {
      return !searchValue || String(room).includes(searchValue);
    });

    if (rooms.length === 0) {
      const msg = document.createElement("div");
      msg.className = "quick-tools-selected-card";
      msg.innerText = "No rooms found.";
      box.appendChild(msg);
      return;
    }

    rooms.forEach(function(room) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "yellow";
      btn.innerHTML = '<span class="room-number">' + escapeHtml(room) + '</span>';
      btn.onclick = function() {
        selectQuickToolsItem("room", room, "");
      };
      box.appendChild(btn);
    });
  }

  function getQuickToolsRoomsForFloor(floor) {
    const rooms = [];

    allAreas.forEach(function(area) {
      const room = getRoomKey(area.areaName || "");
      if (!/^\d{3}$/.test(room)) return;
      if (String(room).charAt(0) !== String(floor)) return;
      if (!rooms.includes(room)) rooms.push(room);
    });

    return rooms.sort(function(a, b) {
      return Number(a) - Number(b);
    });
  }

  function selectQuickToolsItem(type, value, areaId) {
    quickToolsSelectedType = type;
    quickToolsSelectedValue = String(value || "").trim();
    quickToolsSelectedAreaId = areaId || "";

    const label = document.getElementById("quickToolsSelectedLabel");
    const actions = document.getElementById("quickToolsActionButtons");
    const ptacButton = document.getElementById("quickToolsPtacButton");

    if (label) {
      label.classList.remove("hidden");
      label.innerText = (type === "room" ? "Selected Room: " : "Selected Area: ") + quickToolsSelectedValue;
    }

    if (actions) actions.classList.remove("hidden");
    if (ptacButton) ptacButton.classList.toggle("hidden", type !== "room");
  }

  function clearQuickToolsSelection() {
    quickToolsSelectedType = "";
    quickToolsSelectedValue = "";
    quickToolsSelectedAreaId = "";

    const label = document.getElementById("quickToolsSelectedLabel");
    const actions = document.getElementById("quickToolsActionButtons");
    if (label) {
      label.classList.add("hidden");
      label.innerText = "";
    }
    if (actions) actions.classList.add("hidden");
  }

  async function openQuickToolsMaintenance() {
    if (!quickToolsSelectedValue) {
      showAppMessage("Choose a room or area first.");
      return;
    }

    await openMaintenanceInspection();

    const searchInput = document.getElementById("maintenanceInspectionSearchInput");
    if (searchInput) searchInput.value = quickToolsSelectedValue;
    handleMaintenanceInspectionSearchInput();
  }

  async function openQuickToolsRoomReport() {
    if (quickToolsSelectedType !== "room") {
      showAppMessage("Room Report needs a room number.");
      return;
    }

    await openRoomReport(quickToolsSelectedValue);
  }

  async function openQuickToolsDailyReport() {
    if (quickToolsSelectedType !== "room") {
      showAppMessage("Daily Report needs a room number.");
      return;
    }

    await openDailyReport(quickToolsSelectedValue);
  }

  async function openQuickToolsPtac() {
    if (quickToolsSelectedType !== "room") {
      showAppMessage("PTAC needs a room number.");
      return;
    }

    await openPtacDashboard();
    openPtacRoom(quickToolsSelectedValue);
  }


  async function openRoomSafeCheck() {
    if (!hasPermission("editSchedules") && !hasPermission("reports") && !hasPermission("adminDashboard")) {
      showAppMessage("Access not allowed.");
      return;
    }

    showLoading();

    await loadAllAdminData();
    setupRoomSafeFilters();
    drawRoomSafeCheck();

    hideLoading();
    showAdminView("adminRoomSafeCheckView");
  }

  function setupRoomSafeFilters() {
    const dayInput = document.getElementById("roomSafeDayFilter");
    if (dayInput && !dayInput.value) {
      dayInput.value = "All";
    }
  }

  function changeRoomSafeDayFilter() {
    drawRoomSafeCheck();
  }

  function changeRoomSafeDateFilter() {
    drawRoomSafeCheck();
  }

  function changeRoomSafeTypeFilter() {
    const typeFilter = document.getElementById("roomSafeTypeFilter");
    const dayFilter = document.getElementById("roomSafeDayFilter");

    if (typeFilter && dayFilter && isRoomSafeNoWeekdayType(typeFilter.value)) {
      dayFilter.value = "All";
    }

    drawRoomSafeCheck();
  }

  function clearRoomSafeFilters() {
    const scheduleFilter = document.getElementById("roomSafeScheduleFilter");
    const typeFilter = document.getElementById("roomSafeTypeFilter");
    const dayFilter = document.getElementById("roomSafeDayFilter");

    if (scheduleFilter) scheduleFilter.value = "All";
    if (typeFilter) typeFilter.value = "All";
    if (dayFilter) dayFilter.value = "All";

    drawRoomSafeCheck();
  }

  function getRoomSafeFilterValues() {
    const scheduleFilter = document.getElementById("roomSafeScheduleFilter");
    const typeFilter = document.getElementById("roomSafeTypeFilter");
    const dayFilter = document.getElementById("roomSafeDayFilter");
    const dayValue = dayFilter ? String(dayFilter.value || "All").trim() : "All";

    return {
      schedule: scheduleFilter ? String(scheduleFilter.value || "All") : "All",
      type: typeFilter ? String(typeFilter.value || "All") : "All",
      dayName: dayValue || "All"
    };
  }

  function isRoomSafeNoWeekdayType(typeValue) {
    return typeValue === "Daily Room" || typeValue === "Common Area" || typeValue === "Dehumidifier";
  }

  function isRoomSafeNamedAreaType(typeValue) {
    return typeValue === "Common Area";
  }

  function getRoomSafeAreaKey(area, typeValue) {
    if (isRoomSafeNamedAreaType(typeValue)) {
      return String(area.areaName || "").trim();
    }

    return getRoomKey(area.areaName || "");
  }

  function getRoomSafeCategoryLabel(typeValue) {
    if (typeValue === "Weekly Room") return "Weekly Rooms by Day";
    if (typeValue === "Daily Room") return "Daily Rooms Only";
    if (typeValue === "Common Area") return "Common Areas";
    if (typeValue === "Dehumidifier") return "Dehumidifiers";
    return "All room checks";
  }

  function isRoomSafeCategoryWithSimpleMaster(typeValue) {
    return typeValue === "Common Area" || typeValue === "Dehumidifier";
  }

  function getRoomSafeDailyMasterOverride(assignment) {
    const list = ROOM_SAFE_DAILY_MASTER_BY_ASSIGNMENT[assignment];
    if (!Array.isArray(list)) return null;
    return list.slice();
  }

  function getRoomSafeFallbackDailyRoomsForAssignment(assignment) {
    const map = {};

    allAreas.forEach(function(area) {
      if (area.active === false || area.active === "No") return;
      if (getAreaAssignment(area) !== assignment) return;
      if (area.category !== "Daily Room") return;

      const roomKey = getRoomKey(area.areaName || "");
      const dayText = String(area.scheduleDay || area.day || "daily").trim().toLowerCase();

      if (!/^\d{3}$/.test(roomKey)) return;
      if (dayText && dayText !== "daily") return;

      map[roomKey] = true;
    });

    allRoomSettings.forEach(function(setting) {
      const settingAssignment = String(setting.schedule || "").trim();
      const roomKey = getRoomKey(setting.roomKey || setting.roomName || "");

      if (settingAssignment !== assignment) return;
      if (!/^\d{3}$/.test(roomKey)) return;
      if (setting.isDaily !== true) return;

      map[roomKey] = true;
    });

    return sortRoomNumbers(Object.keys(map));
  }

  function getRoomSafeDailyMasterRoomsForAssignment(assignment) {
    const override = getRoomSafeDailyMasterOverride(assignment);
    if (override) return sortRoomNumbers(override);
    return getRoomSafeFallbackDailyRoomsForAssignment(assignment);
  }

  function getMasterRoomNumbersForSafeCheck(filters) {
    const map = {};
    const safeFilters = filters || { schedule: "All", type: "All", dayName: "All" };
    const selectedDay = String(safeFilters.dayName || "All").trim().toLowerCase();

    if (safeFilters.type === "Weekly Room") {
      allAreas.forEach(function(area) {
        if (area.active === false || area.active === "No") return;
        if (area.category !== "Weekly Room") return;

        const assignment = getAreaAssignment(area);
        const roomKey = getRoomKey(area.areaName || "");
        const areaDay = String(area.scheduleDay || area.day || "").trim().toLowerCase();

        if (!/^\d{3}$/.test(roomKey)) return;
        if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return;
        if (safeFilters.schedule !== "All" && assignment !== safeFilters.schedule) return;
        if (selectedDay !== "all" && areaDay !== selectedDay) return;

        map[roomKey] = true;
      });

      return sortRoomNumbers(Object.keys(map));
    }

    if (isRoomSafeCategoryWithSimpleMaster(safeFilters.type)) {
      allAreas.forEach(function(area) {
        if (area.active === false || area.active === "No") return;
        if (area.category !== safeFilters.type) return;

        const assignment = getAreaAssignment(area);
        const areaKey = getRoomSafeAreaKey(area, safeFilters.type);

        if (!areaKey) return;
        if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return;
        if (safeFilters.schedule !== "All" && assignment !== safeFilters.schedule) return;

        map[areaKey] = true;
      });

      return sortRoomNumbers(Object.keys(map));
    }

    if (safeFilters.type === "Daily Room") {
      const assignmentsToCheck = safeFilters.schedule === "All"
        ? ROOM_SAFE_ASSIGNMENTS
        : [safeFilters.schedule];

      assignmentsToCheck.forEach(function(assignment) {
        if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return;

        getRoomSafeDailyMasterRoomsForAssignment(assignment).forEach(function(roomKey) {
          map[roomKey] = true;
        });
      });

      return sortRoomNumbers(Object.keys(map));
    }

    allAreas.forEach(function(area) {
      if (area.active === false || area.active === "No") return;
      if (area.category !== "Weekly Room" && area.category !== "Daily Room") return;

      const assignment = getAreaAssignment(area);
      const roomKey = getRoomKey(area.areaName || "");
      const areaDay = String(area.scheduleDay || area.day || "").trim().toLowerCase();

      if (!/^\d{3}$/.test(roomKey)) return;
      if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return;
      if (safeFilters.schedule !== "All" && assignment !== safeFilters.schedule) return;
      if (selectedDay !== "all" && area.category === "Weekly Room" && areaDay !== selectedDay) return;

      map[roomKey] = true;
    });

    allRoomSettings.forEach(function(setting) {
      const assignment = String(setting.schedule || "").trim();
      const roomKey = getRoomKey(setting.roomKey || setting.roomName || "");

      if (!/^\d{3}$/.test(roomKey)) return;
      if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return;
      if (safeFilters.schedule !== "All" && assignment !== safeFilters.schedule) return;
      if (selectedDay !== "all") return;

      map[roomKey] = true;
    });

    return sortRoomNumbers(Object.keys(map));
  }

  function roomSafeAreaMatchesFilters(area, filters) {
    if (area.active === false || area.active === "No") return false;

    const assignment = getAreaAssignment(area);
    if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) return false;

    if (filters.schedule !== "All" && assignment !== filters.schedule) return false;

    const selectedDay = String(filters.dayName || "All").trim().toLowerCase();

    if (filters.type === "Weekly Room") {
      if (area.category !== "Weekly Room") return false;
      if (selectedDay === "all") return true;
      return String(area.scheduleDay || area.day || "").trim().toLowerCase() === selectedDay;
    }

    if (filters.type === "Daily Room") {
      if (area.category !== "Weekly Room" && area.category !== "Daily Room") return false;

      const roomKey = getRoomKey(area.areaName || "");
      const expectedDailyRooms = getRoomSafeDailyMasterRoomsForAssignment(assignment);

      if (!expectedDailyRooms.includes(roomKey)) return false;
      if (area.category === "Daily Room") return true;

      if (area.category === "Weekly Room") {
        const setting = roomSettingsData[assignment + "|" + roomKey] || roomSettingsData[roomKey] || {};
        return setting.isDaily === true;
      }

      return false;
    }

    if (isRoomSafeCategoryWithSimpleMaster(filters.type)) {
      return area.category === filters.type;
    }

    if (area.category !== "Weekly Room" && area.category !== "Daily Room") return false;

    if (selectedDay === "all") return true;

    if (area.category === "Weekly Room") {
      return String(area.scheduleDay || area.day || "").trim().toLowerCase() === selectedDay;
    }

    if (area.category === "Daily Room") {
      const dayText = String(area.scheduleDay || area.day || "daily").trim().toLowerCase();
      return dayText === "" || dayText === "daily" || dayText === selectedDay;
    }

    return true;
  }

  function buildRoomSafeScheduleMap(filters) {
    const map = {};
    const safeFilters = filters || { schedule: "All", type: "All", dayName: "" };

    allAreas.forEach(function(area) {
      if (!roomSafeAreaMatchesFilters(area, safeFilters)) return;

      const assignment = getAreaAssignment(area);
      const roomKey = getRoomSafeAreaKey(area, safeFilters.type);

      if (!roomKey) return;
      if (!isRoomSafeNamedAreaType(safeFilters.type) && !/^\d{3}$/.test(roomKey)) return;

      if (!map[roomKey]) {
        map[roomKey] = {};
      }

      if (!map[roomKey][assignment]) {
        map[roomKey][assignment] = [];
      }

      map[roomKey][assignment].push({
        id: area.id || "",
        workId: area.workId || area.areaId || area.id || "",
        areaName: area.areaName || roomKey,
        schedule: assignment,
        category: area.category,
        day: area.scheduleDay || area.day || "daily"
      });
    });

    return map;
  }

  function getRoomsFoundInAssignments(masterRooms, scheduleMap, assignments) {
    return masterRooms.filter(function(room) {
      const foundSchedules = scheduleMap[room] || {};

      return assignments.some(function(assignment) {
        return !!foundSchedules[assignment];
      });
    });
  }

  function getRoomsMissingFromAssignments(masterRooms, scheduleMap, assignments) {
    const foundMap = {};

    getRoomsFoundInAssignments(masterRooms, scheduleMap, assignments).forEach(function(room) {
      foundMap[room] = true;
    });

    return masterRooms.filter(function(room) {
      return foundMap[room] !== true;
    });
  }

  function getRoomSafeAssignmentCount(scheduleMap, assignment) {
    return Object.keys(scheduleMap).filter(function(room) {
      return !!(scheduleMap[room] && scheduleMap[room][assignment]);
    }).length;
  }

  function getRoomSafeAssignmentList(filters) {
    if (filters.schedule !== "All") return [filters.schedule];
    return ROOM_SAFE_ASSIGNMENTS;
  }

  function drawRoomSafeCheck() {
    const summary = document.getElementById("roomSafeSummary");
    const missingBox = document.getElementById("roomSafeMissingList");
    const foundBox = document.getElementById("roomSafeFoundList");
    const allBox = document.getElementById("roomSafeAllList");
    const filterLabel = document.getElementById("roomSafeFilterLabel");

    if (!summary || !missingBox || !foundBox || !allBox) return;

    const filters = getRoomSafeFilterValues();
    const masterRooms = getMasterRoomNumbersForSafeCheck(filters);
    const scheduleMap = buildRoomSafeScheduleMap(filters);
    const checkedAssignments = getRoomSafeAssignmentList(filters);
    const foundRooms = getRoomsFoundInAssignments(masterRooms, scheduleMap, checkedAssignments);
    const missingRooms = getRoomsMissingFromAssignments(masterRooms, scheduleMap, checkedAssignments);
    const totalCount = masterRooms.length;
    const foundCount = foundRooms.length;
    const mode2Map = buildRoomSafeScheduleMap({ ...filters, schedule: "All" });
    const mode2MissingRooms = getRoomsMissingFromAssignments(masterRooms, mode2Map, ROOM_SAFE_MODE_2_ASSIGNMENTS);
    const mode3MissingRooms = getRoomsMissingFromAssignments(masterRooms, mode2Map, ROOM_SAFE_MODE_3_ASSIGNMENTS);

    if (filterLabel) {
      const typeLabel = getRoomSafeCategoryLabel(filters.type);
      const dayLabel = isRoomSafeNoWeekdayType(filters.type)
        ? "No weekday needed"
        : (filters.dayName === "All" ? "All days" : filters.dayName);

      filterLabel.innerText =
        "Showing: " +
        (filters.schedule === "All" ? "All schedules" : filters.schedule) +
        " • " + typeLabel +
        " • " + dayLabel;
    }

    const addButton = document.getElementById("roomSafeAddRoomButton");
    const addBox = document.getElementById("roomSafeAddBox");

    if (addButton) {
      const canAddFromSafeCheck = true;
      addButton.classList.toggle("hidden", !canAddFromSafeCheck);

      if (filters.type === "Common Area") {
        addButton.innerText = "ADD COMMON AREA";
      } else if (filters.type === "Dehumidifier") {
        addButton.innerText = "ADD DEHUMIDIFIER";
      } else {
        addButton.innerText = "ADD A ROOM";
      }
    }

    summary.innerHTML =
  '<div class="room-safe-count">' + foundCount + ' out of ' + totalCount + '</div>' +
  (missingRooms.length > 0
    ? '<div class="room-safe-warning">' + missingRooms.length + ' room' + (missingRooms.length === 1 ? '' : 's') + ' not found</div>'
    : '<div class="room-safe-ok">All rooms found</div>');

    drawRoomSafeSingleMissingList(missingBox, missingRooms, filters);
    drawRoomSafeFoundRooms(foundBox, foundRooms, scheduleMap, filters);
    drawRoomSafeAllRooms(allBox, masterRooms, scheduleMap, filters);
  }

  function setRoomSafeAddBoxMode(typeValue) {
    const roomInput = document.getElementById("roomSafeAddRoomInput");
    const dayInput = document.getElementById("roomSafeAddDayInput");
    const dayLabel = dayInput ? dayInput.previousElementSibling : null;
    const title = document.querySelector("#roomSafeAddBox h3");
    const roomLabel = roomInput ? roomInput.previousElementSibling : null;
    const noDayNeeded = typeValue === "Common Area" || typeValue === "Daily Room" || typeValue === "Dehumidifier";

    if (title) {
      if (typeValue === "Common Area") {
        title.innerText = "Add Common Area";
      } else if (typeValue === "Dehumidifier") {
        title.innerText = "Add Dehumidifier";
      } else {
        title.innerText = "Add Room Back";
      }
    }

    if (roomLabel) {
      roomLabel.innerText = typeValue === "Common Area" ? "Common Area Name" : "Room Number";
    }

    if (roomInput) {
      if (typeValue === "Common Area") {
        roomInput.removeAttribute("inputmode");
        roomInput.removeAttribute("maxlength");
        roomInput.removeAttribute("pattern");
        roomInput.placeholder = "Common area name";
        roomInput.oninput = null;
      } else {
        roomInput.setAttribute("inputmode", "numeric");
        roomInput.setAttribute("maxlength", "3");
        roomInput.setAttribute("pattern", "[0-9]*");
        roomInput.placeholder = typeValue === "Dehumidifier" ? "Dehumidifier room" : "Room number";
        roomInput.oninput = function() { limitRoomInput(this); };
      }
    }

    if (dayInput) {
      dayInput.classList.toggle("hidden", noDayNeeded);
    }

    if (dayLabel) {
      dayLabel.classList.toggle("hidden", noDayNeeded);
    }
  }

  function openRoomSafeAddRoom(roomValue) {
    const box = document.getElementById("roomSafeAddBox");
    const roomInput = document.getElementById("roomSafeAddRoomInput");
    const scheduleInput = document.getElementById("roomSafeAddScheduleInput");
    const dayInput = document.getElementById("roomSafeAddDayInput");
    const filters = getRoomSafeFilterValues();

    setRoomSafeAddBoxMode(filters.type);

    if (roomInput) {
      roomInput.value = filters.type === "Common Area"
        ? String(roomValue || "").trim()
        : getRoomKey(roomValue || "");
    }

    if (scheduleInput) scheduleInput.value = filters.schedule === "All" ? "" : filters.schedule;
    if (dayInput) dayInput.value = isRoomSafeNoWeekdayType(filters.type) ? "" : (filters.dayName || "");
    if (box) box.classList.remove("hidden");
    if (roomInput) setTimeout(function() { roomInput.focus(); }, 50);
  }

  function cancelRoomSafeAddRoom() {
    const box = document.getElementById("roomSafeAddBox");
    const roomInput = document.getElementById("roomSafeAddRoomInput");
    const scheduleInput = document.getElementById("roomSafeAddScheduleInput");
    const dayInput = document.getElementById("roomSafeAddDayInput");

    if (roomInput) roomInput.value = "";
    if (scheduleInput) scheduleInput.value = "";
    if (dayInput) dayInput.value = "";
    if (box) box.classList.add("hidden");
  }

  async function saveRoomSafeAddedRoom() {
    const roomInput = document.getElementById("roomSafeAddRoomInput");
    const scheduleInput = document.getElementById("roomSafeAddScheduleInput");
    const dayInput = document.getElementById("roomSafeAddDayInput");
    const typeInput = document.getElementById("roomSafeTypeFilter");

    const selectedType = typeInput ? String(typeInput.value || "Weekly Room") : "Weekly Room";
    const rawName = roomInput ? String(roomInput.value || "").trim() : "";
    const roomKey = selectedType === "Common Area" ? rawName : getRoomKey(rawName);
    const assignment = scheduleInput ? String(scheduleInput.value || "").trim() : "";
    const dayName = dayInput ? String(dayInput.value || "").trim() : "";

    const category =
      selectedType === "Daily Room"
        ? "Daily Room"
        : (selectedType === "Common Area"
          ? "Common Area"
          : (selectedType === "Dehumidifier" ? "Dehumidifier" : "Weekly Room"));

    if (category === "Common Area") {
      if (!roomKey) {
        showAppMessage("Enter common area name.");
        return;
      }
    } else if (!/^\d{3}$/.test(roomKey)) {
      showAppMessage("Enter a 3 digit room number.");
      return;
    }

    if (!ROOM_SAFE_ASSIGNMENTS.includes(assignment)) {
      showAppMessage("Choose schedule.");
      return;
    }

    if (category === "Weekly Room" && !dayName) {
      showAppMessage("Choose day.");
      return;
    }

    const saveDay = category === "Weekly Room" ? dayName : "daily";
    const defaultTasks = category === "Daily Room"
      ? DEFAULT_DAILY_ROOM_TASKS
      : (category === "Weekly Room"
        ? DEFAULT_WEEKLY_ROOM_TASKS
        : (category === "Dehumidifier" ? getDefaultDehumidifierTasks() : []));

    const existingSameRoomDay = allAreas.find(function(area) {
      const existingKey = category === "Common Area"
        ? String(area.areaName || "").trim().toLowerCase()
        : getRoomKey(area.areaName || "");

      const newKey = category === "Common Area"
        ? String(roomKey || "").trim().toLowerCase()
        : roomKey;

      return area.active !== false && area.active !== "No" &&
        getAreaAssignment(area) === assignment &&
        area.category === category &&
        existingKey === newKey &&
        String(area.scheduleDay || area.day || "daily").trim().toLowerCase() === saveDay.toLowerCase();
    });

    if (existingSameRoomDay) {
      showAppMessage((category === "Common Area" ? "Common area " : (category === "Dehumidifier" ? "Dehumidifier room " : "Room ")) + roomKey + " is already on " + assignment + ".");
      return;
    }

    const confirmed = await showAppConfirmMessage("Add " + (category === "Common Area" ? "common area " : (category === "Dehumidifier" ? "dehumidifier room " : "room ")) + roomKey + " to " + assignment + " as " + category + (category === "Weekly Room" ? " for " + dayName : "") + "?");
    if (!confirmed) return;

    showLoading();

    try {
      const workId = buildWorkId(roomKey, category, saveDay, assignment);
      const areaData = getAreaUpdateData(roomKey, assignment, category, saveDay, workId);

      await addDoc(collection(db, "areas"), {
        ...areaData,
        createdAt: serverTimestamp()
      });

      for (let i = 0; i < defaultTasks.length; i++) {
        const taskName = defaultTasks[i];
        const exists = allSubTasks.some(function(task) {
          return String(task.workId || task.areaId || "") === String(workId || "") &&
            String(task.taskName || "").trim().toLowerCase() === taskName.toLowerCase();
        });

        if (!exists) {
          await addDoc(collection(db, "tasks"), getTaskCreateData({
            workId: workId,
            areaId: workId,
            areaName: roomKey,
            category: category,
            scheduleDay: saveDay,
            day: saveDay,
            schedule: assignment,
            modeType: getModeTypeForAssignment(assignment),
            floor: getFloorForAssignment(assignment)
          }, taskName));
        }
      }

      if (category !== "Common Area") {
        await setDoc(doc(db, "room_settings", makeId(assignment + "_" + roomKey)), {
          roomKey: roomKey,
          roomName: roomKey,
          schedule: assignment,
          isDaily: category === "Daily Room",
          hasDehumidifier: category === "Dehumidifier" ? true : undefined,
          isOccupied: true,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await loadAllAdminData();
      drawRoomSafeCheck();
      cancelRoomSafeAddRoom();
      showAppMessage((category === "Common Area" ? "Common area " : (category === "Dehumidifier" ? "Dehumidifier room " : "Room ")) + roomKey + " added to " + assignment + " as " + category + ".");
    } finally {
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
    }
  }

  function buildRoomSafeScheduleCountHtml(scheduleMap) {
    return '<div class="room-safe-small">' +
      'HK1: ' + getRoomSafeAssignmentCount(scheduleMap, "HK1") + ' • ' +
      'HK2: ' + getRoomSafeAssignmentCount(scheduleMap, "HK2") + ' • ' +
      '1stfloor: ' + getRoomSafeAssignmentCount(scheduleMap, "1stfloor") + ' • ' +
      '2ndFloor: ' + getRoomSafeAssignmentCount(scheduleMap, "2ndFloor") + ' • ' +
      '3rdFloor: ' + getRoomSafeAssignmentCount(scheduleMap, "3rdFloor") +
      '</div>';
  }

  function drawRoomSafeSingleMissingList(box, rooms, filters) {
    box.innerHTML = "";

    if (rooms.length === 0) {
      const empty = document.createElement("div");
      empty.className = "room-safe-small";
      empty.innerText = "No missing rooms for this selected check.";
      box.appendChild(empty);
      return;
    }

    drawRoomSafePills(box, rooms, true, filters);
  }

 function isRoomSafeFilterApplied(filters) {
  return filters.schedule !== "All" || filters.type !== "All" || filters.dayName !== "All";
}

function drawRoomSafeFoundRooms(box, rooms, scheduleMap, filters) {
  box.innerHTML = "";

  if (rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "room-safe-small";
    empty.innerText = "No rooms found for this selected check.";
    box.appendChild(empty);
    return;
  }

  const showDetails = isRoomSafeFilterApplied(filters);

  rooms.forEach(function(room) {
    const div = document.createElement("div");
    div.className = "room-safe-room-pill";
    div.innerText = showDetails
      ? room + " - " + getRoomSafeFoundLabel(scheduleMap[room] || {})
      : room;

    div.onclick = function() {
      openRoomSafeItemAction(room, filters, false);
    };

    box.appendChild(div);
  });
}

 function drawRoomSafeAllRooms(box, rooms, scheduleMap, filters) {
  box.innerHTML = "";

  if (rooms.length === 0) {
    const empty = document.createElement("div");
    empty.className = "room-safe-small";
    empty.innerText = "No master rooms found.";
    box.appendChild(empty);
    return;
  }

  const showDetails = isRoomSafeFilterApplied(filters);

  rooms.forEach(function(room) {
    const div = document.createElement("div");
    const foundLabel = getRoomSafeFoundLabel(scheduleMap[room] || {});

    div.className = "room-safe-room-pill";

    if (!foundLabel) {
      div.classList.add("missing");
    }

    div.innerText = showDetails && foundLabel
      ? room + " - " + foundLabel
      : room;

    div.onclick = function() {
      openRoomSafeItemAction(room, filters, !foundLabel);
    };

    box.appendChild(div);
  });
}
  
  function openRoomSafeItemOptions(area, filters) {
    const input = document.getElementById("appMessageInput");
    const actions = document.getElementById("appMessageActions");
    const title = document.getElementById("appMessageTitle");
    const text = document.getElementById("appMessageText");

    appMessageInputCallback = null;
    appMessageCancelCallback = null;

    if (input) {
      input.value = "";
      input.classList.add("hidden");
    }

    if (title) title.innerText = "Room Safe Check";
    if (text) text.innerText = getRoomSafeItemActionLabel(area);

    if (actions) {
      actions.className = "app-message-actions";
      actions.innerHTML = "";

      const editButton = document.createElement("button");
      editButton.className = "green";
      editButton.type = "button";
      editButton.innerText = "EDIT";
      editButton.onclick = function() {
        closeAppMessage();
        adminAreaOpenedFromDailyRoomAccess = filters.type === "Daily Room" && area.category === "Weekly Room";
        openAdminEditArea(area.id);
      };
      actions.appendChild(editButton);

      const moveButton = document.createElement("button");
      moveButton.className = "yellow";
      moveButton.type = "button";
      moveButton.innerText = "MOVE / CHANGE SCHEDULE";
      moveButton.onclick = function() {
        openRoomSafeMoveScheduleOptions(area, filters);
      };
      actions.appendChild(moveButton);

      if (area.category === "Weekly Room") {
        const dayButton = document.createElement("button");
        dayButton.type = "button";
        dayButton.innerText = "CHANGE DAY";
        dayButton.onclick = function() {
          openRoomSafeChangeDayOptions(area, filters);
        };
        actions.appendChild(dayButton);
      }

      const deleteButton = document.createElement("button");
      deleteButton.className = "red";
      deleteButton.type = "button";
      deleteButton.innerText = "DELETE";
      deleteButton.onclick = function() {
        confirmRoomSafeDeleteItem(area.id, filters);
      };
      actions.appendChild(deleteButton);

      const cancelButton = document.createElement("button");
      cancelButton.className = "back";
      cancelButton.type = "button";
      cancelButton.innerText = "CANCEL";
      cancelButton.onclick = function() {
        closeAppMessage();
      };
      actions.appendChild(cancelButton);
    }

    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  function findRoomSafeAreaForAction(itemKey, filters) {
    const safeFilters = filters || getRoomSafeFilterValues();
    const cleanKey = String(itemKey || "").trim();
    const checkedAssignments = getRoomSafeAssignmentList(safeFilters);

    const matches = allAreas.filter(function(area) {
      if (!roomSafeAreaMatchesFilters(area, safeFilters)) return false;
      if (!checkedAssignments.includes(getAreaAssignment(area))) return false;
      return String(getRoomSafeAreaKey(area, safeFilters.type) || "").trim() === cleanKey;
    }).sort(function(a, b) {
      const scheduleCompare = String(getAreaAssignment(a) || "").localeCompare(String(getAreaAssignment(b) || ""));
      if (scheduleCompare !== 0) return scheduleCompare;

      const categoryCompare = String(a.category || "").localeCompare(String(b.category || ""));
      if (categoryCompare !== 0) return categoryCompare;

      return String(a.scheduleDay || a.day || "").localeCompare(String(b.scheduleDay || b.day || ""));
    });

    return matches[0] || null;
  }


  function openRoomSafeChangeDayOptions(area, filters) {
    const input = document.getElementById("appMessageInput");
    const actions = document.getElementById("appMessageActions");
    const title = document.getElementById("appMessageTitle");
    const text = document.getElementById("appMessageText");
    const currentDay = String(area.scheduleDay || area.day || "").trim();

    appMessageInputCallback = null;
    appMessageCancelCallback = null;

    if (input) {
      input.value = "";
      input.classList.add("hidden");
    }

    if (title) title.innerText = "Change Day";
    if (text) text.innerText = "Move " + getRoomSafeItemActionLabel(area) + " to:";

    if (actions) {
      actions.className = "app-message-actions";
      actions.innerHTML = "";

      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].forEach(function(dayName) {
        if (dayName.toLowerCase() === currentDay.toLowerCase()) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "yellow";
        button.innerText = dayName;
        button.onclick = function() {
          confirmRoomSafeChangeDay(area.id, dayName, filters);
        };
        actions.appendChild(button);
      });

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "back";
      cancelButton.innerText = "CANCEL";
      cancelButton.onclick = function() {
        closeAppMessage();
      };
      actions.appendChild(cancelButton);
    }

    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  async function confirmRoomSafeChangeDay(areaId, targetDay, filters) {
    const area = allAreas.find(function(item) {
      return String(item.id || "") === String(areaId || "");
    });

    if (!area) {
      closeAppMessage();
      showAppMessage("Item not found. Refresh and try again.", "Room Safe Check");
      return;
    }

    const cleanTargetDay = String(targetDay || "").trim();
    const oldDay = String(area.scheduleDay || area.day || "").trim();
    const areaName = String(area.areaName || "").trim();

    if (area.category !== "Weekly Room") {
      showAppMessage("Change Day only works for weekly rooms.", "Room Safe Check");
      return;
    }

    if (!["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].includes(cleanTargetDay)) {
      showAppMessage("Choose a valid day.", "Room Safe Check");
      return;
    }

    if (cleanTargetDay.toLowerCase() === oldDay.toLowerCase()) {
      showAppMessage("This room is already on " + cleanTargetDay + ".", "Room Safe Check");
      return;
    }

    const confirmed = await showAppConfirmMessage(
      "Move " + areaName + " from " + oldDay + " to " + cleanTargetDay + "?",
      "Change Day"
    );

    if (!confirmed) return;

    closeAppMessage();
    showLoading();

    try {
      await changeRoomSafeAreaDay(area, cleanTargetDay);

      const dayFilter = document.getElementById("roomSafeDayFilter");
      if (dayFilter) dayFilter.value = cleanTargetDay;

      await loadAllAdminData();
      drawRoomSafeCheck();
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage(areaName + " moved to " + cleanTargetDay + ".", "Room Safe Check");
    } catch (error) {
      console.error("Room Safe change day failed", error);
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage("Change day failed. It may already exist on that day.", "Room Safe Check");
    }
  }

  async function changeRoomSafeAreaDay(area, targetDay) {
    const areaName = String(area.areaName || "").trim();
    const assignment = getAreaAssignment(area);
    const category = String(area.category || "").trim();
    const oldWorkId = area.workId || area.areaId || area.id || "";
    const newWorkId = buildWorkId(areaName, category, targetDay, assignment);

    if (category !== "Weekly Room") {
      throw new Error("Only weekly rooms can change day");
    }

    const duplicate = allAreas.find(function(item) {
      if (String(item.id || "") === String(area.id || "")) return false;
      if (item.active === false || item.active === "No") return false;
      if (getAreaAssignment(item) !== assignment) return false;
      if (String(item.category || "") !== category) return false;
      if (String(item.areaName || "").trim().toLowerCase() !== areaName.toLowerCase()) return false;
      return String(item.scheduleDay || item.day || "").trim().toLowerCase() === targetDay.toLowerCase();
    });

    if (duplicate) {
      throw new Error("Duplicate target day");
    }

    await updateDoc(doc(db, "areas", area.id), getAreaUpdateData(areaName, assignment, category, targetDay, newWorkId));

    const tasksToMove = allSubTasks.filter(function(task) {
      return String(task.workId || task.areaId || "") === String(oldWorkId || "");
    });

    for (let i = 0; i < tasksToMove.length; i++) {
      await updateDoc(doc(db, "tasks", tasksToMove[i].id), {
        areaId: newWorkId,
        workId: newWorkId,
        areaName: areaName,
        areaSearch: String(areaName || "").toLowerCase(),
        category: category,
        categoryKey: makeId(category),
        day: targetDay,
        schedule: assignment,
        modeType: getModeTypeForAssignment(assignment),
        modeLabel: assignment,
        floor: getFloorForAssignment(assignment),
        updatedAt: serverTimestamp()
      });
    }
  }

  function openRoomSafeMoveScheduleOptions(area, filters) {
    const input = document.getElementById("appMessageInput");
    const actions = document.getElementById("appMessageActions");
    const title = document.getElementById("appMessageTitle");
    const text = document.getElementById("appMessageText");
    const currentSchedule = getAreaAssignment(area);

    appMessageInputCallback = null;
    appMessageCancelCallback = null;

    if (input) {
      input.value = "";
      input.classList.add("hidden");
    }

    if (title) title.innerText = "Move Schedule";
    if (text) text.innerText = "Move " + getRoomSafeItemActionLabel(area) + " to:";

    if (actions) {
      actions.className = "app-message-actions";
      actions.innerHTML = "";

      ROOM_SAFE_ASSIGNMENTS.forEach(function(assignment) {
        if (assignment === currentSchedule) return;

        const button = document.createElement("button");
        button.type = "button";
        button.className = "yellow";
        button.innerText = assignment;
        button.onclick = function() {
          confirmRoomSafeMoveSchedule(area.id, assignment, filters);
        };
        actions.appendChild(button);
      });

      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "back";
      cancelButton.innerText = "CANCEL";
      cancelButton.onclick = function() {
        closeAppMessage();
      };
      actions.appendChild(cancelButton);
    }

    document.getElementById("appMessageBox").classList.remove("hidden");
  }

  async function confirmRoomSafeMoveSchedule(areaId, targetAssignment, filters) {
    const area = allAreas.find(function(item) {
      return String(item.id || "") === String(areaId || "");
    });

    if (!area) {
      closeAppMessage();
      showAppMessage("Item not found. Refresh and try again.", "Room Safe Check");
      return;
    }

    const safeFilters = filters || getRoomSafeFilterValues();
    const oldAssignment = getAreaAssignment(area);
    const cleanTarget = String(targetAssignment || "").trim();
    const areaName = String(area.areaName || "").trim();
    const category = String(area.category || "").trim();
    const scheduleDay = isWeeklyCategory(category)
      ? String(area.scheduleDay || area.day || "").trim()
      : "daily";
    const roomKey = getRoomKey(areaName);

    if (!ROOM_SAFE_ASSIGNMENTS.includes(cleanTarget)) {
      showAppMessage("Choose a valid schedule.", "Room Safe Check");
      return;
    }

    if (cleanTarget === oldAssignment) {
      showAppMessage("This item is already on " + cleanTarget + ".", "Room Safe Check");
      return;
    }

    closeAppMessage();

const confirmed = await showAppConfirmMessage(
  "You moved room " + areaName + " from schedule " + oldAssignment + " to schedule " + cleanTarget + ". Do you want to keep the changes?",
  "Keep Changes?"
);

if (!confirmed) {
  showAdminView("adminRoomSafeCheckView");
  return;
}
    closeAppMessage();
    showLoading();

    try {
      if (safeFilters.type === "Daily Room" && category === "Weekly Room" && roomKey) {
        await moveRoomSafeDailyLabelOnly(area, oldAssignment, cleanTarget, roomKey);
      } else {
        await moveRoomSafeAreaRecord(area, cleanTarget, scheduleDay);
      }

      const scheduleFilter = document.getElementById("roomSafeScheduleFilter");
      if (scheduleFilter) scheduleFilter.value = cleanTarget;

      await loadAllAdminData();
      drawRoomSafeCheck();
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage(areaName + " moved to " + cleanTarget + ".", "Room Safe Check");
    } catch (error) {
      console.error("Room Safe move failed", error);
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage("Move failed. Refresh and try again.", "Room Safe Check");
    }
  }

  async function moveRoomSafeDailyLabelOnly(area, oldAssignment, targetAssignment, roomKey) {
    const oldSettingRef = doc(db, "room_settings", makeId(oldAssignment + "_" + roomKey));
    const newSettingRef = doc(db, "room_settings", makeId(targetAssignment + "_" + roomKey));
    const oldSetting = roomSettingsData[oldAssignment + "|" + roomKey] || roomSettingsData[roomKey] || {};

    await setDoc(oldSettingRef, {
      roomKey: roomKey,
      roomName: area.areaName || roomKey,
      schedule: oldAssignment,
      isDaily: false,
      updatedAt: serverTimestamp()
    }, { merge: true });

    await setDoc(newSettingRef, {
      ...oldSetting,
      roomKey: roomKey,
      roomName: area.areaName || roomKey,
      schedule: targetAssignment,
      isDaily: true,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async function moveRoomSafeAreaRecord(area, targetAssignment, scheduleDay) {
    const areaName = String(area.areaName || "").trim();
    const category = String(area.category || "").trim();
    const oldWorkId = area.workId || area.areaId || area.id || "";
    const oldAssignment = getAreaAssignment(area);
    const newWorkId = buildWorkId(areaName, category, scheduleDay, targetAssignment);
    const roomKey = getRoomKey(areaName);

    const duplicate = allAreas.find(function(item) {
      if (String(item.id || "") === String(area.id || "")) return false;
      if (item.active === false || item.active === "No") return false;
      if (getAreaAssignment(item) !== targetAssignment) return false;
      if (String(item.category || "") !== category) return false;
      if (String(item.areaName || "").trim().toLowerCase() !== areaName.toLowerCase()) return false;
      return String(item.scheduleDay || item.day || "daily").trim().toLowerCase() === String(scheduleDay || "daily").trim().toLowerCase();
    });

    if (duplicate) {
      throw new Error("Duplicate target item");
    }

    await updateDoc(doc(db, "areas", area.id), getAreaUpdateData(areaName, targetAssignment, category, scheduleDay, newWorkId));

    const tasksToMove = allSubTasks.filter(function(task) {
      return String(task.workId || task.areaId || "") === String(oldWorkId || "");
    });

    for (let i = 0; i < tasksToMove.length; i++) {
      await updateDoc(doc(db, "tasks", tasksToMove[i].id), {
        areaId: newWorkId,
        workId: newWorkId,
        areaName: areaName,
        areaSearch: String(areaName || "").toLowerCase(),
        category: category,
        categoryKey: makeId(category),
        day: scheduleDay,
        schedule: targetAssignment,
        modeType: getModeTypeForAssignment(targetAssignment),
        modeLabel: targetAssignment,
        floor: getFloorForAssignment(targetAssignment),
        updatedAt: serverTimestamp()
      });
    }

    if (category === "Daily Room" && roomKey) {
      await setDoc(doc(db, "room_settings", makeId(oldAssignment + "_" + roomKey)), {
        roomKey: roomKey,
        roomName: areaName,
        schedule: oldAssignment,
        isDaily: false,
        updatedAt: serverTimestamp()
      }, { merge: true });

      await setDoc(doc(db, "room_settings", makeId(targetAssignment + "_" + roomKey)), {
        roomKey: roomKey,
        roomName: areaName,
        schedule: targetAssignment,
        isDaily: true,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  async function confirmRoomSafeDeleteItem(areaId, filters) {
    const area = allAreas.find(function(item) {
      return String(item.id || "") === String(areaId || "");
    });

    if (!area) {
      closeAppMessage();
      showAppMessage("Item not found. Refresh and try again.", "Room Safe Check");
      return;
    }

    const safeFilters = filters || getRoomSafeFilterValues();
    const label = getRoomSafeItemActionLabel(area);
    const roomKey = getRoomKey(area.areaName || "");
    const assignment = getAreaAssignment(area);
    const isDailyLabelOnly = safeFilters.type === "Daily Room" && area.category === "Weekly Room" && roomKey;
    const isWeeklyRoom = area.category === "Weekly Room";

    let message = "Delete " + label + " from this selected check?";

    if (isDailyLabelOnly) {
      message = "Remove Daily Room label from room " + roomKey + " on " + assignment + "?";
    } else if (isWeeklyRoom) {
      message = "Delete room " + area.areaName + " from " + (area.scheduleDay || area.day || "this day") + " only?";
    } else if (area.category === "Common Area") {
      message = "Delete common area " + area.areaName + " and its tasks?";
    } else if (area.category === "Dehumidifier") {
      message = "Delete dehumidifier " + area.areaName + " and its tasks?";
    }

    const confirmed = await showAppConfirmMessage(message, "Delete Item");
    if (!confirmed) return;

    closeAppMessage();
    showLoading();

    try {
      await deleteRoomSafeItem(area, safeFilters);
      await loadAllAdminData();
      drawRoomSafeCheck();
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage("Deleted from selected check.", "Room Safe Check");
    } catch (error) {
      console.error("Room Safe delete failed", error);
      hideLoading();
      showAdminView("adminRoomSafeCheckView");
      showAppMessage("Delete failed. Refresh and try again.", "Room Safe Check");
    }
  }

  async function deleteRoomSafeItem(area, filters) {
    const safeFilters = filters || getRoomSafeFilterValues();
    const assignment = getAreaAssignment(area);
    const roomKey = getRoomKey(area.areaName || "");
    const workId = area.workId || area.areaId || area.id || "";

    if (safeFilters.type === "Daily Room" && area.category === "Weekly Room" && roomKey) {
      await setDoc(doc(db, "room_settings", makeId(assignment + "_" + roomKey)), {
        roomKey: roomKey,
        roomName: area.areaName || roomKey,
        schedule: assignment,
        isDaily: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return;
    }

    const tasksToDelete = allSubTasks.filter(function(task) {
      return String(task.workId || task.areaId || "") === String(workId || "");
    });

    for (let i = 0; i < tasksToDelete.length; i++) {
      await deleteDoc(doc(db, "tasks", tasksToDelete[i].id));
    }

    await deleteDoc(doc(db, "areas", area.id));

    if (roomKey && area.category === "Daily Room") {
      await setDoc(doc(db, "room_settings", makeId(assignment + "_" + roomKey)), {
        roomKey: roomKey,
        roomName: area.areaName || roomKey,
        schedule: assignment,
        isDaily: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }

    if (roomKey && area.category === "Dehumidifier") {
      await setDoc(doc(db, "room_settings", makeId(assignment + "_" + roomKey)), {
        roomKey: roomKey,
        roomName: area.areaName || roomKey,
        schedule: assignment,
        hasDehumidifier: false,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  }

  function getRoomSafeItemActionLabel(area) {
    const name = String(area.areaName || "").trim();
    const category = String(area.category || "").trim();
    const assignment = getAreaAssignment(area);
    const day = String(area.scheduleDay || area.day || "daily").trim();

    if (category === "Weekly Room") {
      return name + " - " + assignment + " - Weekly " + day;
    }

    if (category === "Daily Room") {
      return name + " - " + assignment + " - Daily Room";
    }

    if (category === "Common Area") {
      return name + " - " + assignment + " - Common Area";
    }

    if (category === "Dehumidifier") {
      return name + " - " + assignment + " - Dehumidifier";
    }

    return name || "item";
  }

  function getRoomSafeFoundLabel(foundSchedules) {
    const labels = [];

    ROOM_SAFE_ASSIGNMENTS.forEach(function(assignment) {
      const entries = foundSchedules[assignment];
      if (!entries || entries.length === 0) return;

      const detail = entries.map(function(entry) {
        if (entry.category === "Common Area") return "Common";
        if (entry.category === "Dehumidifier") return "Dehumi";

        const typeLabel = entry.category === "Daily Room" ? "Daily" : "Weekly";
        const dayLabel = String(entry.day || "").toLowerCase() === "daily" ? "Daily" : entry.day;
        return typeLabel + " " + dayLabel;
      }).join("/");

      labels.push(assignment + " " + detail);
    });

    return labels.join(", ");
  }

  function drawRoomSafePills(box, rooms, missingOnly, filters) {
    rooms.forEach(function(room) {
      const div = document.createElement("div");
      div.className = "room-safe-room-pill";

      if (missingOnly) {
        div.classList.add("missing");
      }

      div.innerText = room;
      div.onclick = function() {
        openRoomSafeItemAction(room, filters || getRoomSafeFilterValues(), missingOnly);
      };

      box.appendChild(div);
    });
  }

  function sortRoomNumbers(rooms) {
    return rooms.sort(function(a, b) {
      return String(a).localeCompare(String(b), undefined, { numeric: true });
    });
  }


  /* =========================
     44C - DAILY STATUS
  ========================== */

  async function openDailyStatus() {
    if (!requirePermission("dailyStatus")) return;
    document.getElementById("dailyStatusDatePicker").value = currentWorkDateISO;
    document.getElementById("dailyStatusCategoryFilter").value = "All";
    document.getElementById("dailyStatusResultFilter").value = "All";
    document.getElementById("dailyStatusSearchInput").value = "";
    await loadDailyStatusRecords();
    drawDailyStatusList();
    updateAssignmentTitles();
    showAdminView("adminDailyStatusView");
  }

  async function changeDailyStatusDate() {
    const picker = document.getElementById("dailyStatusDatePicker");
    if (!picker.value) return;
    currentWorkDateISO = picker.value;
    updateDateDisplay();
    await loadDailyStatusRecords();
    drawDailyStatusList();
  }

  async function loadDailyStatusRecords() {
    showLoading();

    const statusQuery = query(
      collection(db, "task_area_status"),
      where("workDateISO", "==", currentWorkDateISO)
    );

    const snap = await getDocs(statusQuery);

    allStatusRecords = snap.docs
      .map(function(statusDoc) {
        return {
          id: statusDoc.id,
          ...statusDoc.data()
        };
      })
      .filter(function(item) {
        return String(item.schedule || "") === String(currentAssignment || "");
      })
      .sort(function(a, b) {
        return String(a.areaName || "").localeCompare(String(b.areaName || ""));
      });

    hideLoading();
  }

  function drawDailyStatusList() {
    const listBox = document.getElementById("dailyStatusList");
    const summaryBox = document.getElementById("dailyStatusSummary");
    const categoryFilter = document.getElementById("dailyStatusCategoryFilter").value;
    const statusFilter = document.getElementById("dailyStatusResultFilter").value;
    const searchText = String(document.getElementById("dailyStatusSearchInput").value || "").trim().toLowerCase();

    listBox.innerHTML = "";

    const expectedAreas = getExpectedAreasForDailyStatus(categoryFilter);
    const statusByArea = {};

    allStatusRecords.forEach(function(record) {
      if (!record.areaId) return;
      statusByArea[String(record.areaId)] = record;
    });

    let rows = expectedAreas.map(function(area) {
      const record = statusByArea[String(area.workId || area.areaId || area.id)] || null;
      return buildDailyStatusRow(area, record);
    });

    rows = rows.filter(function(row) {
      if (categoryFilter !== "All" && row.category !== categoryFilter) return false;
      if (statusFilter !== "All" && row.statusValue !== statusFilter) return false;

      if (searchText) {
        const combined = [
          row.areaName,
          row.employeeName,
          row.category,
          row.statusLabel,
          row.taskText
        ].join(" ").toLowerCase();

        if (!combined.includes(searchText)) return false;
      }

      return true;
    });

    const doneCount = rows.filter(function(row) { return row.statusValue === "Completed"; }).length;
    const issueCount = rows.filter(function(row) { return row.statusValue === "Incomplete"; }).length;
    const missingCount = rows.filter(function(row) { return row.statusValue === "Missing"; }).length;

    summaryBox.innerHTML =
      '<h3>' + escapeHtml(currentAssignment + " - " + currentWorkDateISO) + '</h3>' +
      '<div class="workload-row"><span>Done</span><span>' + doneCount + '</span></div>' +
      '<div class="workload-row"><span>Not Done / Issue</span><span>' + issueCount + '</span></div>' +
      '<div class="workload-row"><span>No Save</span><span>' + missingCount + '</span></div>' +
      '<div class="workload-total">TOTAL: ' + rows.length + '</div>';

    if (rows.length === 0) {
      const empty = document.createElement("h3");
      empty.innerText = "No records found.";
      listBox.appendChild(empty);
      return;
    }

    rows.forEach(function(row) {
      const card = document.createElement("div");
      card.className = "status-card";

      const colorClass = row.statusValue === "Completed"
        ? "green"
        : row.statusValue === "Incomplete"
          ? "yellow"
          : "red";

      card.innerHTML =
        '<h3>' + escapeHtml(row.areaName) + '</h3>' +
        '<div class="status-line">Status: ' + escapeHtml(row.statusLabel) + '</div>' +
        '<div class="status-line">Category: ' + escapeHtml(row.category) + '</div>' +
        '<div class="status-line">Employee: ' + escapeHtml(row.employeeName) + '</div>' +
        '<div class="status-line">Count: ' + escapeHtml(row.countText) + '</div>' +
        '<button class="' + colorClass + '">' + escapeHtml(row.statusLabel.toUpperCase()) + '</button>' +
        row.taskHtml;

      listBox.appendChild(card);
    });
  }

  function getExpectedAreasForDailyStatus(categoryFilter) {
    return allAreasForAssignment.filter(function(area) {
      if (categoryFilter !== "All" && area.category !== categoryFilter) return false;

      if (isWeeklyCategory(area.category)) {
        return String(area.scheduleDay || "").trim().toLowerCase() === currentWorkDayName.toLowerCase();
      }

      return isAreaForCurrentDay(area);
    });
  }

  function buildDailyStatusRow(area, record) {
    const areaName = area.areaName || "Area";
    const category = area.category || "";

    if (!record) {
      return {
        areaName: areaName,
        category: category,
        employeeName: "",
        statusValue: "Missing",
        statusLabel: "No Save",
        countText: "0/" + getTasksForWorkId(area.workId).length,
        taskText: "",
        taskHtml: ""
      };
    }

    const completed = Number(record.completedCount || 0);
    const incomplete = Number(record.incompleteCount || 0);
    const total = Number(record.totalCount || completed + incomplete || 0);
    const statusValue = incomplete > 0 ? "Incomplete" : "Completed";
    const statusLabel = statusValue === "Completed" ? "Done" : "Not Done / Issue";
    const tasks = record.tasks || {};
    const taskKeys = Object.keys(tasks);
    let taskText = "";
    let taskHtml = "";

    taskKeys.forEach(function(taskKey) {
      const task = tasks[taskKey] || {};
      const line = String(task.taskName || "Task") + " - " + String(task.status || "") + (task.reason ? " - " + task.reason : "");
      taskText += " " + line;
      taskHtml += '<div class="status-task-line">' + escapeHtml(line) + '</div>';
    });

    return {
      areaName: areaName,
      category: category,
      employeeName: record.employeeName || "",
      statusValue: statusValue,
      statusLabel: statusLabel,
      countText: completed + "/" + total,
      taskText: taskText,
      taskHtml: taskHtml
    };
  }

  /* =========================
     44D - ISSUE REASONS
  ========================== */

  async function openIssueReasons() {
    if (!requirePermission("editIssueReasons")) return;
    showLoading();

    const snap = await getDocs(collection(db, "issue_reasons"));

    allIssueReasons = snap.docs.map(function(reasonDoc) {
      return {
        id: reasonDoc.id,
        ...reasonDoc.data()
      };
    }).sort(function(a, b) {
      return String(a.reasonText || "").localeCompare(String(b.reasonText || ""));
    });

    document.getElementById("newIssueReasonInput").value = "";
    document.getElementById("issueReasonSearchInput").value = "";

    drawIssueReasonList();

    hideLoading();
    updateAssignmentTitles();
    showAdminView("adminIssueReasonsView");
  }

  function drawIssueReasonList() {
    const box = document.getElementById("issueReasonList");
    const searchText = String(document.getElementById("issueReasonSearchInput").value || "").trim().toLowerCase();

    box.innerHTML = "";

    let reasons = allIssueReasons.filter(function(reason) {
      if (!searchText) return true;
      return String(reason.reasonText || "").toLowerCase().includes(searchText);
    });

    if (reasons.length === 0) {
      const empty = document.createElement("h3");
      empty.innerText = "No reasons found.";
      box.appendChild(empty);
      return;
    }

    reasons.forEach(function(reason) {
      const active = reason.active !== false;
      const card = document.createElement("div");
      card.className = "reason-card";

      card.innerHTML =
        '<h3>' + escapeHtml(reason.reasonText || "Reason") + '</h3>' +
        '<div class="reason-line">Status: ' + (active ? 'Active' : 'Inactive') + '</div>' +
        '<div class="button-row-three">' +
          '<button class="' + (active ? 'yellow' : 'green') + '" onclick="toggleIssueReason(\'' + reason.id + '\')">' + (active ? 'DISABLE' : 'ENABLE') + '</button>' +
          '<button class="red" onclick="deleteIssueReason(\'' + reason.id + '\')">DELETE</button>' +
          '<button class="back" onclick="editIssueReasonPrompt(\'' + reason.id + '\')">EDIT</button>' +
        '</div>';

      box.appendChild(card);
    });
  }

  async function addIssueReason() {
    const reasonText = document.getElementById("newIssueReasonInput").value.trim();

    if (!reasonText) {
      alert("Type a reason.");
      return;
    }

    const exists = allIssueReasons.some(function(reason) {
      return String(reason.reasonText || "").trim().toLowerCase() === reasonText.toLowerCase();
    });

    if (exists) {
      alert("Reason already exists.");
      return;
    }

    showLoading();

    await addDoc(collection(db, "issue_reasons"), {
      reasonText: reasonText,
      active: true,
      createdBy: sessionData.name || sessionData.employeeName || "Admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    await openIssueReasons();
    hideLoading();
  }

  async function toggleIssueReason(reasonId) {
    const reason = allIssueReasons.find(function(item) {
      return item.id === reasonId;
    });

    if (!reason) return;

    showLoading();

    await updateDoc(doc(db, "issue_reasons", reasonId), {
      active: reason.active === false,
      updatedAt: serverTimestamp()
    });

    await openIssueReasons();
    hideLoading();
  }

  async function deleteIssueReason(reasonId) {
    const reason = allIssueReasons.find(function(item) {
      return item.id === reasonId;
    });

    const ok = confirm("Delete reason " + (reason ? reason.reasonText : "") + "?");
    if (!ok) return;

    showLoading();

    await deleteDoc(doc(db, "issue_reasons", reasonId));

    await openIssueReasons();
    hideLoading();
  }

  async function editIssueReasonPrompt(reasonId) {
    const reason = allIssueReasons.find(function(item) {
      return item.id === reasonId;
    });

    if (!reason) return;

    const newText = prompt("Edit reason:", reason.reasonText || "");

    if (newText === null) return;

    const cleanText = newText.trim();

    if (!cleanText) {
      alert("Reason cannot be blank.");
      return;
    }

    showLoading();

    await updateDoc(doc(db, "issue_reasons", reasonId), {
      reasonText: cleanText,
      updatedAt: serverTimestamp()
    });

    await openIssueReasons();
    hideLoading();
  }



  /* =========================
     44E - MAINTENANCE INSPECTION
  ========================== */

  function openMaintenanceTextPopup(title, message, placeholder, currentValue, saveCallback) {
    maintenancePopupSaveCallback = saveCallback;

    const titleBox = document.getElementById("maintenanceTextPopupTitle");
    const textBox = document.getElementById("maintenanceTextPopupText");
    const inputBox = document.getElementById("maintenanceTextPopupInput");
    const popup = document.getElementById("maintenanceTextPopup");

    if (titleBox) titleBox.innerText = title || "Maintenance";
    if (textBox) textBox.innerText = message || "Type value.";
    if (inputBox) {
      inputBox.value = currentValue || "";
      inputBox.placeholder = placeholder || "Type here";
    }
    if (popup) popup.classList.remove("hidden");

    setTimeout(function() {
      if (inputBox) inputBox.focus();
    }, 50);
  }

  function confirmMaintenanceTextPopup() {
    const inputBox = document.getElementById("maintenanceTextPopupInput");
    const value = String(inputBox ? inputBox.value : "").trim();
    const callback = maintenancePopupSaveCallback;

    maintenancePopupSaveCallback = null;
    cancelMaintenanceTextPopup();

    if (callback) {
      callback(value);
    }
  }

  function cancelMaintenanceTextPopup() {
    const popup = document.getElementById("maintenanceTextPopup");
    const inputBox = document.getElementById("maintenanceTextPopupInput");

    if (popup) popup.classList.add("hidden");
    if (inputBox) inputBox.value = "";
    maintenancePopupSaveCallback = null;
  }

  function openMaintenanceNewItemPopup() {
    openMaintenanceTextPopup(
      "New Inspection Item",
      "Type the new thing being inspected.",
      "Example: Grab Bar",
      "",
      async function(value) {
        if (!value) {
          showAppMessage("Type inspection item.");
          return;
        }

        showLoading();
        const newItem = await saveNewMaintenanceInspectionItem(value);
        fillMaintenanceInspectionItemSelect();

        const select = document.getElementById("maintenanceInspectionItemSelect");
        if (select && newItem) {
          select.value = newItem.id;
        }

        changeMaintenanceInspectionItem();
        hideLoading();
      }
    );
  }

  function openMaintenanceNewReasonPopup() {
    const item = getSelectedMaintenanceInspectionItem();

    if (!item) {
      showAppMessage("Select thing being inspected first.");
      return;
    }

    openMaintenanceTextPopup(
      "New Fail Reason",
      "Type the new fail reason.",
      "Example: Loose handle",
      "",
      async function(value) {
        if (!value) {
          showAppMessage("Type fail reason.");
          return;
        }

        showLoading();
        await saveNewMaintenanceInspectionFailReason(item, value);
        drawMaintenanceInspectionFailReasons(item);
        selectMaintenanceInspectionReason(value);
        hideLoading();
      }
    );
  }

  function openMaintenanceMaterialsPopup() {
    const item = getSelectedMaintenanceInspectionItem();

    if (!item) {
      showAppMessage("Select thing being inspected first.");
      return;
    }

    openMaintenanceTextPopup(
      "Materials Needed",
      "Type material needed.",
      "Example: Wax ring",
      "",
      async function(value) {
        if (!value) {
          showAppMessage("Type material.");
          return;
        }

        showLoading();
        await saveNewMaintenanceInspectionMaterial(item, value);
        drawMaintenanceInspectionMaterials(item);
        selectMaintenanceInspectionMaterial(value);
        hideLoading();
      }
    );
  }

  function getMaintenanceInspectionMaterials(item) {
    const materials = [];

    if (!item) return materials;

    if (Array.isArray(item.materialOptions)) {
      item.materialOptions.forEach(function(material) {
        const cleanMaterial = String(material || "").trim();
        if (cleanMaterial && !materials.includes(cleanMaterial)) materials.push(cleanMaterial);
      });
    }

    const defaultMaterial = String(item.materialsNeeded || "").trim();
    if (defaultMaterial && !materials.includes(defaultMaterial)) {
      materials.push(defaultMaterial);
    }

    return materials;
  }

  function drawMaintenanceInspectionMaterials(item) {
    const select = document.getElementById("maintenanceInspectionMaterialsSelect");
    const materialsBox = document.getElementById("maintenanceInspectionMaterialsInput");

    if (select) {
      select.innerHTML = '<option value="">Select material</option>';
    }

    if (materialsBox) {
      materialsBox.value = "";
    }

    if (!item) return;

    getMaintenanceInspectionMaterials(item).forEach(function(material) {
      if (select) {
        const option = document.createElement("option");
        option.value = material;
        option.innerText = material;
        select.appendChild(option);
      }
    });
  }

  function selectMaintenanceInspectionMaterial(material) {
    const cleanMaterial = String(material || "").trim();
    const select = document.getElementById("maintenanceInspectionMaterialsSelect");
    const materialsBox = document.getElementById("maintenanceInspectionMaterialsInput");

    if (select) {
      select.value = cleanMaterial;
    }

    if (materialsBox) {
      materialsBox.value = cleanMaterial;
    }
  }

  async function saveNewMaintenanceInspectionMaterial(item, material) {
    const cleanMaterial = String(material || "").trim();
    if (!item || !item.id || !cleanMaterial) return;

    const existingMaterials = getMaintenanceInspectionMaterials(item).map(function(value) {
      return String(value || "").trim().toLowerCase();
    });

    if (existingMaterials.includes(cleanMaterial.toLowerCase())) {
      return;
    }

    await updateDoc(doc(db, "maintenance_inspection_items", item.id), {
      materialOptions: arrayUnion(cleanMaterial),
      updatedAt: serverTimestamp()
    });

    if (!Array.isArray(item.materialOptions)) {
      item.materialOptions = [];
    }

    item.materialOptions.push(cleanMaterial);
  }

  async function openMaintenanceDashboard() {
    if (!requirePermission("maintenanceInspection") && !hasPermission("maintenanceWorkBoard") && !hasPermission("materialsNeeded")) return;
    showLoading();
    try {
      if (allAreas.length === 0) {
        await loadAllAdminData();
      }

      await loadMaintenanceInspectionRecords();
      drawMaintenanceDashboardSummary();
      applyMaintenanceDashboardPermissions();
      updateAssignmentTitles();
      showAdminView("adminMaintenanceDashboardView");
    } finally {
      hideLoading();
    }
  }

  function getMaintenanceWorkflowStatus(record) {
    const savedStatus = String(record.workflowStatus || "").trim();
    if (savedStatus) return savedStatus;

    const result = String(record.result || "").toLowerCase();
    const openStatus = String(record.openStatus || record.status || "").toLowerCase();
    const hasMaterial = String(record.materialsNeeded || "").trim() !== "";

    if (openStatus === "resolved" || openStatus === "good") return "Resolved";
    if (result === "good") {
      return record.reinspectionOfIssueId || record.reinspectionOfInspectionId ? "Resolved" : "Passed";
    }
    if (result === "fail") {
      if (hasMaterial) return "Needs Material";
      return "Needs Repair";
    }

    return "Waiting for Inspection";
  }

  function isMaintenanceWorkflowOpen(record) {
    const status = getMaintenanceWorkflowStatus(record);
    return status !== "Passed" && status !== "Resolved";
  }

  function getMaintenanceWorkflowCounts(records) {
    const today = getTodayISO();
    const counts = {
      today: 0,
      open: 0,
      materials: 0,
      ready: 0,
      waiting: 0,
      done: 0
    };

    records.forEach(function(record) {
      const status = getMaintenanceWorkflowStatus(record);
      const recordDate = getMaintenanceInspectionReportDateISO(record);

      if (recordDate === today) counts.today++;
      if (isMaintenanceWorkflowOpen(record)) counts.open++;
      if (status === "Needs Material") counts.materials++;
      if (status === "Ready for Re-Inspect") counts.ready++;
      if (status === "Waiting for Inspection") counts.waiting++;
      if (recordDate === today && (status === "Passed" || status === "Resolved")) counts.done++;
    });

    return counts;
  }

  function buildMaintenanceSummaryHtml(counts) {
    return '' +
      '<div class="maintenance-summary-tile">Today<span>' + counts.today + '</span></div>' +
      '<div class="maintenance-summary-tile">Open<span>' + counts.open + '</span></div>' +
      '<div class="maintenance-summary-tile">Materials<span>' + counts.materials + '</span></div>' +
      '<div class="maintenance-summary-tile">Re-Inspect<span>' + counts.ready + '</span></div>';
  }

  function drawMaintenanceDashboardSummary() {
    const box = document.getElementById("maintenanceDashboardSummary");
    if (!box) return;
    box.innerHTML = buildMaintenanceSummaryHtml(getMaintenanceWorkflowCounts(allMaintenanceInspectionRecords));
  }

  async function openMaintenanceWorkBoard() {
    if (!requirePermission("maintenanceWorkBoard")) return;
    showLoading();
    try {
      await loadMaintenanceInspectionRecords();
      drawMaintenanceWorkBoard();
      updateAssignmentTitles();
      showAdminView("adminMaintenanceWorkBoardView");
    } finally {
      hideLoading();
    }
  }

  function drawMaintenanceWorkBoard() {
    const summaryBox = document.getElementById("maintenanceWorkBoardSummary");
    const listBox = document.getElementById("maintenanceWorkBoardList");
    if (summaryBox) {
      summaryBox.innerHTML = buildMaintenanceSummaryHtml(getMaintenanceWorkflowCounts(allMaintenanceInspectionRecords));
    }
    if (!listBox) return;

    const today = getTodayISO();
    const openRecords = allMaintenanceInspectionRecords.filter(isMaintenanceWorkflowOpen)
      .sort(function(a, b) {
        return getMaintenanceWorkflowPriority(a) - getMaintenanceWorkflowPriority(b) ||
          getRecordSortValue(b) - getRecordSortValue(a);
      });
    const completedToday = allMaintenanceInspectionRecords.filter(function(record) {
      const status = getMaintenanceWorkflowStatus(record);
      return getMaintenanceInspectionReportDateISO(record) === today &&
        (status === "Passed" || status === "Resolved");
    }).sort(function(a, b) {
      return getRecordSortValue(b) - getRecordSortValue(a);
    });

    const usedRecordIds = new Set();
    function takeRecords(filterFn) {
      return openRecords.filter(function(record) {
        if (usedRecordIds.has(record.id)) return false;
        if (!filterFn(record)) return false;
        usedRecordIds.add(record.id);
        return true;
      });
    }

    let html = "";
    html += buildMaintenanceWorkBoardSection("High Urgency", takeRecords(function(record) {
      return String(record.urgency || "").toLowerCase() === "high";
    }));
    html += buildMaintenanceWorkBoardSection("Needs Materials", takeRecords(function(record) {
      return getMaintenanceWorkflowStatus(record) === "Needs Material";
    }));
    html += buildMaintenanceWorkBoardSection("Ready for Re-Inspect", takeRecords(function(record) {
      return getMaintenanceWorkflowStatus(record) === "Ready for Re-Inspect";
    }));
    html += buildMaintenanceWorkBoardSection("Needs Repair", takeRecords(function(record) {
      return getMaintenanceWorkflowStatus(record) === "Needs Repair";
    }));
    html += buildMaintenanceWorkBoardSection("Waiting for Inspection", takeRecords(function(record) {
      return getMaintenanceWorkflowStatus(record) === "Waiting for Inspection";
    }));
    html += buildMaintenanceWorkBoardSection("Completed Today", completedToday);

    listBox.innerHTML = html || '<div class="room-report-card">No maintenance items to show.</div>';
  }

  function getMaintenanceWorkflowPriority(record) {
    const status = getMaintenanceWorkflowStatus(record);
    const urgency = String(record.urgency || "").toLowerCase();
    if (urgency === "high") return 1;
    if (status === "Needs Material") return 2;
    if (status === "Ready for Re-Inspect") return 3;
    if (urgency === "med") return 4;
    if (status === "Needs Repair") return 5;
    if (status === "Waiting for Inspection") return 6;
    return 9;
  }

  function buildMaintenanceWorkBoardSection(title, records) {
    if (!records.length) return "";
    return '<div class="maintenance-section-label">' + escapeHtml(title) + '</div>' +
      records.map(buildMaintenanceWorkBoardCard).join("");
  }

  function buildMaintenanceWorkBoardCard(record) {
    const status = getMaintenanceWorkflowStatus(record);
    const result = String(record.result || "").toLowerCase() === "fail" ? "FAIL" : "GOOD";
    const isOpen = isMaintenanceWorkflowOpen(record);
    const canMarkReady = status === "Needs Material" || status === "Needs Repair";

    return '' +
      '<div class="room-report-card">' +
        '<div class="maintenance-status-pill">' + escapeHtml(status) + '</div>' +
        '<h3>' + escapeHtml(record.areaName || record.roomKey || "Area") + ' - ' + escapeHtml(record.inspectionItem || "Inspection") + '</h3>' +
        '<div>Result: ' + escapeHtml(result) + (record.urgency ? ' - ' + escapeHtml(record.urgency) : '') + '</div>' +
        '<div>Reason: ' + escapeHtml(record.failReason || "None") + '</div>' +
        '<div>Materials: ' + escapeHtml(record.materialsNeeded || "None") + '</div>' +
        '<div>Saved: ' + escapeHtml(record.createdDateTimeText || getRecordDateTimeText(record)) + '</div>' +
        '<div>Employee: ' + escapeHtml(record.employeeName || "Admin") + '</div>' +
        (canMarkReady ? '<button class="green" onclick="markMaintenanceInspectionReady(\'' + escapeHtml(record.id) + '\')">MARK READY</button>' : '') +
        (isOpen ? '<button class="yellow" onclick="reinspectMaintenanceIssue(\'' + escapeHtml(record.id) + '\')">RE-INSPECT</button>' : '') +
      '</div>';
  }

  async function markMaintenanceInspectionReady(recordId) {
    if (!recordId) return;
    showLoading();
    try {
      await updateDoc(doc(db, "maintenance_inspections", recordId), {
        workflowStatus: "Ready for Re-Inspect",
        openStatus: "Open",
        status: "Open",
        updatedAt: serverTimestamp()
      });

      const record = allMaintenanceInspectionRecords.find(function(item) {
        return item.id === recordId;
      });
      if (record) {
        record.workflowStatus = "Ready for Re-Inspect";
        record.openStatus = "Open";
        record.status = "Open";
      }

      const issueSnap = await getDocs(collection(db, "issue_logs"));
      const linkedIssue = issueSnap.docs.find(function(issueDoc) {
        const issue = issueDoc.data();
        return issue.sourceInspectionId === recordId;
      });
      if (linkedIssue) {
        await updateDoc(doc(db, "issue_logs", linkedIssue.id), {
          workflowStatus: "Ready for Re-Inspect",
          status: "Open",
          updatedAt: serverTimestamp()
        });
      }

      drawMaintenanceWorkBoard();
    } finally {
      hideLoading();
    }
  }

  function selectMaintenanceResidentStatus(status) {
    selectedMaintenanceResidentStatus = status === "Vacant" ? "Vacant" : "Occupied";
    updateMaintenanceResidentButtons();
  }

  function updateMaintenanceResidentButtons() {
    const occupiedBtn = document.getElementById("maintenanceResidentOccupiedBtn");
    const vacantBtn = document.getElementById("maintenanceResidentVacantBtn");

    if (occupiedBtn) occupiedBtn.className = selectedMaintenanceResidentStatus === "Occupied" ? "green" : "";
    if (vacantBtn) vacantBtn.className = selectedMaintenanceResidentStatus === "Vacant" ? "green" : "";
  }

  function selectMaintenanceUrgency(urgency) {
    selectedMaintenanceUrgency = selectedMaintenanceUrgency === urgency ? "" : urgency;
    updateMaintenanceUrgencyButtons();
  }

  function updateMaintenanceUrgencyButtons() {
    const options = [
      { id: "maintenanceUrgencyLowBtn", value: "Low", className: "yellow" },
      { id: "maintenanceUrgencyMedBtn", value: "Med", className: "orange" },
      { id: "maintenanceUrgencyHighBtn", value: "High", className: "red" }
    ];

    options.forEach(function(option) {
      const btn = document.getElementById(option.id);
      if (!btn) return;
      btn.className = selectedMaintenanceUrgency === option.value ? option.className : "";
    });
  }

  function getMaintenanceRoomSetting(area) {
    const roomKey = getRoomKey(area?.areaName || area?.roomKey || "");
    const assignment = getAreaAssignment(area || {});
    return roomSettingsData[assignment + "|" + roomKey] || roomSettingsData[roomKey] || {};
  }

  function getMaintenanceAreaResidentStatus(area) {
    const setting = getMaintenanceRoomSetting(area);
    const settingStatus = String(setting.residentStatus || setting.occupancyStatus || "").trim().toLowerCase();
    if (setting.isOccupied === false || settingStatus === "vacant") return "Vacant";
    if (setting.isOccupied === true || settingStatus === "occupied") return "Occupied";
    return getMaintenanceInspectionResidentStatus([area]).toLowerCase() === "vacant" ? "Vacant" : "Occupied";
  }

  async function loadMaintenanceInspectionItems() {
    const snap = await getDocs(collection(db, "maintenance_inspection_items"));

    allMaintenanceInspectionItems = snap.docs
      .map(function(itemDoc) {
        return {
          id: itemDoc.id,
          ...itemDoc.data()
        };
      })
      .filter(function(item) {
        return item.active !== false;
      })
      .sort(function(a, b) {
        const aOrder = Number(a.sortOrder || 0);
        const bOrder = Number(b.sortOrder || 0);
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.inspectionItem || "").localeCompare(String(b.inspectionItem || ""));
      });
  }

  async function openMaintenanceInspection() {
    if (!requirePermission("maintenanceInspection")) return;
    showLoading();

    if (allAreas.length === 0) {
      await loadAllAdminData();
    }

    await loadMaintenanceInspectionItems();

    selectedMaintenanceInspectionArea = null;
    selectedMaintenanceInspectionReason = "";
    selectedMaintenanceResidentStatus = "Occupied";
    selectedMaintenanceUrgency = "";
    maintenanceReinspectIssueId = "";
    maintenanceReinspectInspectionId = "";

    document.getElementById("maintenanceInspectionSearchInput").value = "";
    document.getElementById("maintenanceInspectionNoteInput").value = "";
    document.getElementById("maintenanceInspectionMaterialsInput").value = "";
    document.getElementById("maintenanceInspectionNewReasonInput").value = "";
    document.getElementById("maintenanceInspectionNewItemInput").value = "";
    document.getElementById("maintenanceInspectionMessage").innerText = "";
    drawMaintenanceInspectionMaterials(null);
    updateMaintenanceResidentButtons();
    updateMaintenanceUrgencyButtons();

    fillMaintenanceInspectionItemSelect();
    drawMaintenanceInspectionAreaList();
    clearMaintenanceInspectionSelectedArea();

    hideLoading();
    updateAssignmentTitles();
    showAdminView("adminMaintenanceInspectionView");

    setTimeout(function() {
      const startButton = document.getElementById("maintenanceInspectionStartButton");
      if (startButton) startButton.focus();
    }, 50);
  }

  function fillMaintenanceInspectionItemSelect() {
    const select = document.getElementById("maintenanceInspectionItemSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Select item</option>';

    allMaintenanceInspectionItems.forEach(function(item) {
      const option = document.createElement("option");
      option.value = item.id;
      option.innerText = item.inspectionItem || item.id;
      select.appendChild(option);
    });

    drawMaintenanceInspectionFailReasons(null);
  }

  function handleMaintenanceInspectionSearchInput() {
    const input = document.getElementById("maintenanceInspectionSearchInput");
    if (!input) return;

    const rawValue = String(input.value || "");
    const digitsOnly = rawValue.replace(/\D/g, "");

    if (/^\d+$/.test(rawValue) && rawValue.length > 3) {
      input.value = digitsOnly.slice(0, 3);
    }

    drawMaintenanceInspectionAreaList();
  }

  function openMaintenanceInspectionStartPopup() {
    maintenanceStartSearchType = "room";

    const popup = document.getElementById("maintenanceStartPopup");
    const titleBox = document.getElementById("maintenanceStartTitle");
    const textBox = document.getElementById("maintenanceStartText");
    const choiceActions = document.getElementById("maintenanceStartChoiceActions");
    const inputBox = document.getElementById("maintenanceStartInputBox");
    const input = document.getElementById("maintenanceStartInput");
    const areaSelect = document.getElementById("maintenanceStartAreaSelect");

    if (titleBox) titleBox.innerText = "Start Inspection";
    if (textBox) textBox.innerText = "Choose what you want to inspect.";
    if (choiceActions) choiceActions.classList.remove("hidden");
    if (inputBox) inputBox.classList.add("hidden");
    if (input) input.value = "";
    if (areaSelect) areaSelect.value = "";
    if (popup) popup.classList.remove("hidden");
  }

  function chooseMaintenanceInspectionSearchType(type) {
    maintenanceStartSearchType = type === "area" ? "area" : "room";

    const titleBox = document.getElementById("maintenanceStartTitle");
    const textBox = document.getElementById("maintenanceStartText");
    const choiceActions = document.getElementById("maintenanceStartChoiceActions");
    const inputBox = document.getElementById("maintenanceStartInputBox");
    const input = document.getElementById("maintenanceStartInput");
    const areaSelect = document.getElementById("maintenanceStartAreaSelect");

    if (titleBox) titleBox.innerText = maintenanceStartSearchType === "room" ? "Choose Room" : "Choose Area";
    if (textBox) textBox.innerText = maintenanceStartSearchType === "room" ? "Type the room number." : "Choose an area from the list.";
    if (choiceActions) choiceActions.classList.add("hidden");
    if (inputBox) inputBox.classList.remove("hidden");

    if (input) {
      input.value = "";
      input.placeholder = maintenanceStartSearchType === "room" ? "Room number" : "Area name";
      input.type = maintenanceStartSearchType === "room" ? "tel" : "text";
      input.inputMode = maintenanceStartSearchType === "room" ? "numeric" : "text";
      input.maxLength = maintenanceStartSearchType === "room" ? 3 : 40;
      input.classList.toggle("hidden", maintenanceStartSearchType === "area");
      if (maintenanceStartSearchType === "room") {
        setTimeout(function() { input.focus(); }, 50);
      }
    }

    if (areaSelect) {
      areaSelect.classList.toggle("hidden", maintenanceStartSearchType !== "area");
      areaSelect.value = "";
      if (maintenanceStartSearchType === "area") {
        fillMaintenanceStartAreaSelect();
        setTimeout(function() { areaSelect.focus(); }, 50);
      }
    }
  }

  function fillMaintenanceStartAreaSelect() {
    const areaSelect = document.getElementById("maintenanceStartAreaSelect");
    if (!areaSelect) return;

    const choices = getMaintenanceStartAreaChoices();
    areaSelect.innerHTML = '<option value="">Choose area</option>';

    if (choices.length === 0) {
      areaSelect.innerHTML += '<option value="">No areas found</option>';
      return;
    }

    choices.forEach(function(choice) {
      const option = document.createElement("option");
      option.value = choice.value;
      option.innerText = choice.label;
      areaSelect.appendChild(option);
    });
  }

  function getMaintenanceStartAreaChoices() {
    const groups = {};

    allAreas.forEach(function(area) {
      const areaName = String(area.areaName || "").trim();
      if (!areaName) return;
      if (isMaintenanceRoomName(areaName)) return;

      const groupKey = areaName.toLowerCase();
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(area);
    });

    return Object.keys(groups).map(function(groupKey) {
      const areas = groups[groupKey].sort(sortMaintenanceInspectionAreaChoice);
      const primaryArea = areas[0];
      return {
        value: primaryArea.areaName || groupKey,
        label: primaryArea.areaName || groupKey
      };
    }).sort(function(a, b) {
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });
    });
  }

  function isMaintenanceRoomName(value) {
    return /^\d{3,4}$/.test(String(value || "").trim());
  }

  function handleMaintenanceStartInput() {
    const input = document.getElementById("maintenanceStartInput");
    if (!input) return;

    if (maintenanceStartSearchType === "room") {
      input.value = String(input.value || "").replace(/\D/g, "").slice(0, 3);
      if (input.value.length === 3) {
        confirmMaintenanceInspectionStartPopup();
      }
    }
  }

  function confirmMaintenanceInspectionStartPopup() {
    const startInput = document.getElementById("maintenanceStartInput");
    const areaSelect = document.getElementById("maintenanceStartAreaSelect");
    const searchInput = document.getElementById("maintenanceInspectionSearchInput");
    const rawValue = maintenanceStartSearchType === "area"
      ? String(areaSelect ? areaSelect.value : "").trim()
      : String(startInput ? startInput.value : "").trim();
    const cleanValue = maintenanceStartSearchType === "room"
      ? rawValue.replace(/\D/g, "").slice(0, 3)
      : rawValue;

    if (!cleanValue) {
      const textBox = document.getElementById("maintenanceStartText");
      if (textBox) textBox.innerText = maintenanceStartSearchType === "room" ? "Type the room number." : "Choose an area from the list.";
      return;
    }

    if (searchInput) {
      searchInput.value = cleanValue;
    }

    cancelMaintenanceInspectionStartPopup();
    handleMaintenanceInspectionSearchInput();
  }

  function cancelMaintenanceInspectionStartPopup() {
    const popup = document.getElementById("maintenanceStartPopup");
    const input = document.getElementById("maintenanceStartInput");
    const areaSelect = document.getElementById("maintenanceStartAreaSelect");

    if (popup) popup.classList.add("hidden");
    if (input) input.value = "";
    if (areaSelect) areaSelect.value = "";
  }

  function drawMaintenanceInspectionAreaList() {
    const box = document.getElementById("maintenanceInspectionAreaList");
    const input = document.getElementById("maintenanceInspectionSearchInput");
    const searchText = String(input ? input.value : "").trim().toLowerCase();

    if (box) box.innerHTML = "";

    if (!searchText) {
      selectedMaintenanceInspectionArea = null;
      clearMaintenanceInspectionSelectedArea();
      return;
    }

    const groupedResults = getMaintenanceInspectionGroupedAreas(searchText);

    if (groupedResults.length === 0) {
      selectedMaintenanceInspectionArea = null;
      showMaintenanceInspectionFoundLabel(null, "No room or area found.");
      return;
    }

    selectMaintenanceInspectionArea(groupedResults[0].primaryArea.id);
  }

  function getMaintenanceInspectionGroupedAreas(searchText) {
    const exactRoomKey = getRoomKey(searchText);
    const groups = {};

    allAreas.forEach(function(area) {
      const areaRoomKey = getRoomKey(area.areaName);
      const matchRank = getMaintenanceInspectionAreaMatchRank(area, searchText, exactRoomKey);
      const combined = [
        area.areaName,
        area.category,
        area.schedule,
        area.scheduleDay,
        area.floor
      ].join(" ").toLowerCase();

      if (!combined.includes(searchText) && matchRank >= 99 && areaRoomKey !== exactRoomKey) return;

      const groupKey = areaRoomKey || String(area.areaName || "").trim().toLowerCase();
      if (!groupKey) return;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          matchRank: matchRank,
          areas: []
        };
      }

      groups[groupKey].matchRank = Math.min(groups[groupKey].matchRank, matchRank);
      groups[groupKey].areas.push(area);
    });

    return Object.keys(groups).map(function(groupKey) {
      const areas = groups[groupKey].areas.sort(sortMaintenanceInspectionAreaChoice);
      const primaryArea = areas[0];

      return {
        groupKey: groupKey,
        label: primaryArea.areaName || groupKey,
        primaryArea: primaryArea,
        count: areas.length,
        matchRank: groups[groupKey].matchRank
      };
    }).sort(function(a, b) {
      if (a.matchRank !== b.matchRank) return a.matchRank - b.matchRank;
      return String(a.label || "").localeCompare(String(b.label || ""), undefined, { numeric: true });
    });
  }

  function getMaintenanceInspectionAreaMatchRank(area, searchText, exactRoomKey) {
    const areaName = String(area.areaName || "").trim();
    const cleanSearch = String(searchText || "").trim().toLowerCase();
    const areaRoomKey = getRoomKey(areaName);
    const roomTokens = getMaintenanceRoomTokens(areaName);

    if (exactRoomKey && /^\d+$/.test(exactRoomKey)) {
      if (areaName.replace(/\D/g, "") === exactRoomKey && roomTokens.length <= 1) return 1;
      if (roomTokens.includes(exactRoomKey)) return 2;
      if (areaRoomKey === exactRoomKey) return 3;
    }

    const combined = [
      area.areaName,
      area.category,
      area.schedule,
      area.scheduleDay,
      area.floor
    ].join(" ").toLowerCase();

    return cleanSearch && combined.includes(cleanSearch) ? 4 : 99;
  }

  function getMaintenanceRoomTokens(value) {
    return String(value || "").match(/\d+/g) || [];
  }

  function sortMaintenanceInspectionAreaChoice(a, b) {
    const order = {
      "Weekly Room": 1,
      "Daily Room": 2,
      "Common Area": 3,
      "Dehumidifier": 4,
      "Daily Laundry": 5,
      "Weekly Laundry": 6
    };

    const aOrder = order[a.category] || 99;
    const bOrder = order[b.category] || 99;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return String(getAreaAssignment(a) || "").localeCompare(String(getAreaAssignment(b) || ""));
  }

  function selectMaintenanceInspectionArea(areaId) {
    selectedMaintenanceInspectionArea = allAreas.find(function(area) {
      return area.id === areaId;
    }) || null;

    if (selectedMaintenanceInspectionArea) {
      selectedMaintenanceResidentStatus = getMaintenanceAreaResidentStatus(selectedMaintenanceInspectionArea);
      updateMaintenanceResidentButtons();
    }

    showMaintenanceInspectionFoundLabel(selectedMaintenanceInspectionArea, "");
  }

  function showMaintenanceInspectionFoundLabel(area, message) {
    const selectedBox = document.getElementById("maintenanceInspectionSelectedArea");
    const actionRow = document.getElementById("maintenanceInspectionActionRow");
    const listBox = document.getElementById("maintenanceInspectionAreaList");

    if (listBox) listBox.innerHTML = "";

    if (!selectedBox) return;

    if (!area) {
      selectedBox.classList.remove("hidden");
      selectedBox.innerHTML = '<div class="maintenance-selected-room-number">' + escapeHtml(message || "No room or area found.") + '</div>';
      if (actionRow) actionRow.classList.add("hidden");
      return;
    }

    const roomKey = getRoomKey(area.areaName || "");
    const foundLabel = roomKey ? "ROOM FOUND" : "AREA FOUND";
    const residentStatus = getMaintenanceAreaResidentStatus(area);

    selectedBox.classList.remove("hidden");
    selectedBox.innerHTML =
      '<div class="maintenance-selected-room-number">' + escapeHtml(foundLabel + ': ' + (area.areaName || "Area")) + '</div>' +
      '<div class="maintenance-selected-settings">Resident Status: ' + escapeHtml(residentStatus) + '</div>';

    if (actionRow) actionRow.classList.remove("hidden");
  }

  function getMaintenanceInspectionRoomSettingLines(area) {
    const lines = [];
    const roomKey = getRoomKey(area.areaName || "");

    if (!roomKey) {
      lines.push(area.category || "Area");
      if (getAreaAssignment(area)) lines.push(getAreaAssignment(area));
      return lines;
    }

    const matchingAreas = allAreas.filter(function(item) {
      return getRoomKey(item.areaName || "") === roomKey;
    });

    const residentStatus = getMaintenanceInspectionResidentStatus(matchingAreas);

    if (residentStatus) {
      lines.push(residentStatus);
    }

    if (matchingAreas.some(function(item) { return String(item.category || "") === "Daily Room"; }) ||
        Object.keys(roomSettingsData || {}).some(function(key) {
          const setting = roomSettingsData[key] || {};
          return getRoomKey(setting.roomKey || setting.roomName || "") === roomKey && setting.isDaily === true;
        })) {
      lines.push("Daily Room");
    }

    if (matchingAreas.some(function(item) { return String(item.category || "") === "Weekly Room"; })) {
      lines.push("Weekly Room");
    }

    if (matchingAreas.some(function(item) { return String(item.category || "") === "Dehumidifier"; })) {
      lines.push("Dehumidifier");
    }

    if (matchingAreas.some(function(item) { return String(item.category || "").includes("Laundry") || getAreaAssignment(item) === "Laundry"; })) {
      lines.push("Laundry");
    }

    return lines.length > 0 ? lines : [area.category || "Active"];
  }

  function getMaintenanceInspectionResidentStatus(areas) {
    const statusFields = [
      "residentStatus",
      "roomStatus",
      "occupancyStatus",
      "occupancy",
      "residentState",
      "status"
    ];

    for (let a = 0; a < areas.length; a++) {
      for (let f = 0; f < statusFields.length; f++) {
        const value = String((areas[a] || {})[statusFields[f]] || "").trim();
        const lower = value.toLowerCase();

        if (["vacant", "occupied", "hospital", "assisted"].includes(lower)) {
          return value;
        }
      }
    }

    return areas.length > 0 ? "Occupied / Active" : "";
  }

  function clearMaintenanceInspectionSelectedArea() {
    const selectedBox = document.getElementById("maintenanceInspectionSelectedArea");
    const actionRow = document.getElementById("maintenanceInspectionActionRow");

    if (selectedBox) {
      selectedBox.innerText = "";
      selectedBox.classList.add("hidden");
    }

    if (actionRow) {
      actionRow.classList.add("hidden");
    }
  }

  function getSelectedMaintenanceInspectionItem() {
    const select = document.getElementById("maintenanceInspectionItemSelect");
    const itemId = select ? select.value : "";

    return allMaintenanceInspectionItems.find(function(item) {
      return item.id === itemId;
    }) || null;
  }

  function changeMaintenanceInspectionItem() {
    let item = getSelectedMaintenanceInspectionItem();
    selectedMaintenanceInspectionReason = "";

    drawMaintenanceInspectionMaterials(item);
    drawMaintenanceInspectionFailReasons(item);
  }

  function drawMaintenanceInspectionFailReasons(item) {
    const select = document.getElementById("maintenanceInspectionReasonSelect");
    const buttonBox = document.getElementById("maintenanceInspectionReasonButtons");

    if (select) {
      select.innerHTML = '<option value="">Select fail reason</option>';
    }

    if (buttonBox) {
      buttonBox.innerHTML = "";
      buttonBox.classList.add("hidden");
    }

    if (!item) return;

    getMaintenanceInspectionFailReasons(item).forEach(function(reason) {
      if (select) {
        const option = document.createElement("option");
        option.value = reason;
        option.innerText = reason;
        select.appendChild(option);
      }
    });
  }

  function getMaintenanceInspectionFailReasons(item) {
    const reasons = [];

    if (Array.isArray(item.failReasons)) {
      item.failReasons.forEach(function(reason) {
        const cleanReason = String(reason || "").trim();
        if (cleanReason && !reasons.includes(cleanReason)) reasons.push(cleanReason);
      });
    }

    for (let i = 1; i <= 12; i++) {
      const cleanReason = String(item["defaultFailReason" + i] || "").trim();
      if (cleanReason && !reasons.includes(cleanReason)) reasons.push(cleanReason);
    }

    return reasons;
  }

  function selectMaintenanceInspectionReason(reason) {
    selectedMaintenanceInspectionReason = String(reason || "").trim();

    const select = document.getElementById("maintenanceInspectionReasonSelect");
    if (select) select.value = selectedMaintenanceInspectionReason;
  }

  function findMaintenanceInspectionAreaFromSearch() {
    if (selectedMaintenanceInspectionArea) return selectedMaintenanceInspectionArea;

    const input = document.getElementById("maintenanceInspectionSearchInput");
    const searchText = String(input ? input.value : "").trim();

    if (!searchText) return null;

    const groupedResults = getMaintenanceInspectionGroupedAreas(searchText.toLowerCase());
    return groupedResults.length > 0 ? groupedResults[0].primaryArea : null;
  }

  async function getOrCreateMaintenanceInspectionItem() {
    const selectedItem = getSelectedMaintenanceInspectionItem();
    const newItemInput = document.getElementById("maintenanceInspectionNewItemInput");
    const newItemName = String(newItemInput ? newItemInput.value : "").trim();

    if (!newItemName) {
      return selectedItem;
    }

    const existingItem = allMaintenanceInspectionItems.find(function(item) {
      return String(item.inspectionItem || "").trim().toLowerCase() === newItemName.toLowerCase();
    });

    if (existingItem) {
      const select = document.getElementById("maintenanceInspectionItemSelect");
      if (select) select.value = existingItem.id;
      return existingItem;
    }

    const newItem = await saveNewMaintenanceInspectionItem(newItemName);
    const select = document.getElementById("maintenanceInspectionItemSelect");

    if (select && newItem) {
      const option = document.createElement("option");
      option.value = newItem.id;
      option.innerText = newItem.inspectionItem;
      select.appendChild(option);
      select.value = newItem.id;
    }

    return newItem;
  }

  async function saveNewMaintenanceInspectionItem(itemName) {
    const cleanItem = String(itemName || "").trim();
    if (!cleanItem) return null;

    const itemId = makeId(cleanItem);
    const itemData = {
      inspectionItem: cleanItem,
      inspectionItemKey: itemId,
      inspectionItemSearch: cleanItem.toLowerCase(),
      category: "Maintenance",
      areaType: "All",
      failReasons: [],
      materialsNeeded: "",
      allowPictures: false,
      openIssueOnFail: true,
      active: true,
      sortOrder: allMaintenanceInspectionItems.length + 1,
      source: "admin",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(doc(db, "maintenance_inspection_items", itemId), itemData, { merge: true });

    const newItem = {
      id: itemId,
      ...itemData,
      createdAt: null,
      updatedAt: null
    };

    allMaintenanceInspectionItems.push(newItem);
    return newItem;
  }

  function isOpenMaintenanceIssue(issue, roomKey, inspectionItem) {
    const status = String(issue.status || "Open");
    return issue.source === "maintenance_inspection" &&
      (status === "Open" || status === "Needs Follow-Up") &&
      getRoomKey(issue.roomKey || issue.areaName || "") === roomKey &&
      String(issue.taskName || "").trim().toLowerCase() === String(inspectionItem || "").trim().toLowerCase();
  }

  async function findOpenMaintenanceIssue(roomKey, inspectionItem) {
    const snap = await getDocs(collection(db, "issue_logs"));
    const matches = snap.docs
      .map(function(issueDoc) {
        return { id: issueDoc.id, ref: issueDoc.ref, ...issueDoc.data() };
      })
      .filter(function(issue) {
        return isOpenMaintenanceIssue(issue, roomKey, inspectionItem);
      })
      .sort(function(a, b) {
        return getRecordSortTime(b) - getRecordSortTime(a);
      });

    return matches[0] || null;
  }

  async function resolveOpenMaintenanceIssues(roomKey, inspectionItem, noteText) {
    const snap = await getDocs(collection(db, "issue_logs"));
    const matches = snap.docs
      .map(function(issueDoc) {
        return { id: issueDoc.id, ref: issueDoc.ref, ...issueDoc.data() };
      })
      .filter(function(issue) {
        if (maintenanceReinspectIssueId && issue.id === maintenanceReinspectIssueId) return true;
        return isOpenMaintenanceIssue(issue, roomKey, inspectionItem);
      });

    for (let i = 0; i < matches.length; i++) {
      await updateDoc(doc(db, "issue_logs", matches[i].id), {
        status: "Resolved",
        workflowStatus: "Resolved",
        needsFollowUp: false,
        followUpNote: noteText || "Passed re-inspection.",
        resolvedBy: sessionData.name || sessionData.employeeName || "Admin",
        lastUpdated: getDateTimeNow(),
        updatedAt: serverTimestamp()
      });

      if (matches[i].sourceInspectionId) {
        await updateDoc(doc(db, "maintenance_inspections", matches[i].sourceInspectionId), {
          openStatus: "Resolved",
          status: "Resolved",
          workflowStatus: "Resolved",
          resolvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  async function deleteSelectedMaintenanceInspectionItem() {
    const item = getSelectedMaintenanceInspectionItem();

    if (!item || !item.id) {
      showAppMessage("Select thing being inspected.");
      return;
    }

    const ok = await showAppConfirmMessage("Delete " + (item.inspectionItem || "this item") + " from the dropdown?", "Delete Item");
    if (!ok) return;

    showLoading();

    await updateDoc(doc(db, "maintenance_inspection_items", item.id), {
      active: false,
      updatedAt: serverTimestamp()
    });

    allMaintenanceInspectionItems = allMaintenanceInspectionItems.filter(function(currentItem) {
      return currentItem.id !== item.id;
    });

    fillMaintenanceInspectionItemSelect();
    drawMaintenanceInspectionMaterials(null);
    selectedMaintenanceInspectionReason = "";

    hideLoading();
  }

  async function deleteSelectedMaintenanceInspectionReason() {
    const item = getSelectedMaintenanceInspectionItem();
    const select = document.getElementById("maintenanceInspectionReasonSelect");
    const reason = selectedMaintenanceInspectionReason || String(select ? select.value : "").trim();

    if (!item || !item.id) {
      showAppMessage("Select thing being inspected first.");
      return;
    }

    if (!reason) {
      showAppMessage("Select fail reason.");
      return;
    }

    const ok = await showAppConfirmMessage("Delete " + reason + " from the dropdown?", "Delete Reason");
    if (!ok) return;

    const updateData = {
      failReasons: arrayRemove(reason),
      updatedAt: serverTimestamp()
    };

    for (let i = 1; i <= 12; i++) {
      if (String(item["defaultFailReason" + i] || "").trim().toLowerCase() === reason.toLowerCase()) {
        updateData["defaultFailReason" + i] = "";
        item["defaultFailReason" + i] = "";
      }
    }

    showLoading();

    await updateDoc(doc(db, "maintenance_inspection_items", item.id), updateData);

    if (Array.isArray(item.failReasons)) {
      item.failReasons = item.failReasons.filter(function(currentReason) {
        return String(currentReason || "").trim().toLowerCase() !== reason.toLowerCase();
      });
    }

    selectedMaintenanceInspectionReason = "";
    drawMaintenanceInspectionFailReasons(item);

    hideLoading();
  }

  async function deleteSelectedMaintenanceInspectionMaterial() {
    const item = getSelectedMaintenanceInspectionItem();
    const select = document.getElementById("maintenanceInspectionMaterialsSelect");
    const material = String(select ? select.value : "").trim();

    if (!item || !item.id) {
      showAppMessage("Select thing being inspected first.");
      return;
    }

    if (!material) {
      showAppMessage("Select material.");
      return;
    }

    const ok = await showAppConfirmMessage("Delete " + material + " from the dropdown?", "Delete Material");
    if (!ok) return;

    const updateData = {
      materialOptions: arrayRemove(material),
      updatedAt: serverTimestamp()
    };

    if (String(item.materialsNeeded || "").trim().toLowerCase() === material.toLowerCase()) {
      updateData.materialsNeeded = "";
      item.materialsNeeded = "";
    }

    showLoading();

    await updateDoc(doc(db, "maintenance_inspection_items", item.id), updateData);

    if (Array.isArray(item.materialOptions)) {
      item.materialOptions = item.materialOptions.filter(function(currentMaterial) {
        return String(currentMaterial || "").trim().toLowerCase() !== material.toLowerCase();
      });
    }

    drawMaintenanceInspectionMaterials(item);

    hideLoading();
  }

  function resetMaintenanceInspectionForm() {
    selectedMaintenanceInspectionArea = null;
    selectedMaintenanceInspectionReason = "";
    selectedMaintenanceResidentStatus = "Occupied";
    selectedMaintenanceUrgency = "";
    maintenanceReinspectIssueId = "";
    maintenanceReinspectInspectionId = "";

    const searchInput = document.getElementById("maintenanceInspectionSearchInput");
    const itemSelect = document.getElementById("maintenanceInspectionItemSelect");
    const reasonSelect = document.getElementById("maintenanceInspectionReasonSelect");
    const materialSelect = document.getElementById("maintenanceInspectionMaterialsSelect");
    const noteBox = document.getElementById("maintenanceInspectionNoteInput");
    const materialsBox = document.getElementById("maintenanceInspectionMaterialsInput");
    const newReasonBox = document.getElementById("maintenanceInspectionNewReasonInput");
    const newItemBox = document.getElementById("maintenanceInspectionNewItemInput");
    const messageBox = document.getElementById("maintenanceInspectionMessage");
    const listBox = document.getElementById("maintenanceInspectionAreaList");

    if (searchInput) searchInput.value = "";
    if (itemSelect) itemSelect.value = "";
    if (reasonSelect) reasonSelect.innerHTML = '<option value="">Select fail reason</option>';
    if (materialSelect) materialSelect.innerHTML = '<option value="">Select material</option>';
    if (noteBox) noteBox.value = "";
    if (materialsBox) materialsBox.value = "";
    if (newReasonBox) newReasonBox.value = "";
    if (newItemBox) newItemBox.value = "";
    if (messageBox) messageBox.innerText = "";
    if (listBox) listBox.innerHTML = "";

    clearMaintenanceInspectionSelectedArea();
    updateMaintenanceResidentButtons();
    updateMaintenanceUrgencyButtons();
  }

  async function confirmMaintenanceInspectionResult(resultValue) {
    const label = resultValue === "Fail" ? "FAIL" : resultValue === "Complete" ? "COMPLETE" : "GOOD";
    const ok = await showAppConfirmMessage("Save this inspection as " + label + "?", "Confirm Inspection");

    if (!ok) return;

    await saveMaintenanceInspectionResult(resultValue);
  }

  function openMaintenanceInspectionResultPopup() {
    const popup = document.getElementById("maintenanceResultPopup");
    if (popup) popup.classList.remove("hidden");
  }

  function closeMaintenanceInspectionResultPopup() {
    const popup = document.getElementById("maintenanceResultPopup");
    if (popup) popup.classList.add("hidden");
  }

  async function chooseMaintenanceInspectionResult(resultValue) {
    closeMaintenanceInspectionResultPopup();
    await saveMaintenanceInspectionResult(resultValue);
  }

  async function saveMaintenanceInspectionResult(resultValue) {
    const area = findMaintenanceInspectionAreaFromSearch();
    const item = getSelectedMaintenanceInspectionItem();
    const noteBox = document.getElementById("maintenanceInspectionNoteInput");
    const materialsBox = document.getElementById("maintenanceInspectionMaterialsInput");
    const newReasonBox = document.getElementById("maintenanceInspectionNewReasonInput");
    const messageBox = document.getElementById("maintenanceInspectionMessage");
    const result = resultValue === "Fail" ? "Fail" : "Good";
    const typedFailReason = String(newReasonBox ? newReasonBox.value : "").trim();
    const selectedFailReason = selectedMaintenanceInspectionReason || String(document.getElementById("maintenanceInspectionReasonSelect")?.value || "").trim();
    const failReason = typedFailReason || selectedFailReason;

    if (!area) {
      showAppMessage("Select a room or area.");
      return;
    }

    if (!item) {
      showAppMessage("Select thing being inspected.");
      return;
    }

    if (result === "Fail" && !failReason) {
      showAppMessage("Select or type fail reason.");
      return;
    }

    const now = new Date();
    const savedDate = getTodayISO();
    const savedWeekday = getWeekdayName(savedDate);
    const savedTime = now.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
    const savedDateText = savedWeekday + " " + savedDate;
    const savedDateTimeText = savedDateText + " - " + savedTime;
    const materialsNeededText = materialsBox ? materialsBox.value.trim() : "";
    const workflowStatus = result === "Good"
      ? (maintenanceReinspectIssueId || maintenanceReinspectInspectionId ? "Resolved" : "Passed")
      : (materialsNeededText ? "Needs Material" : "Needs Repair");

    const employeeName = sessionData.employeeName || sessionData.name ||
      [sessionData.firstName, sessionData.lastName].filter(Boolean).join(" ") ||
      "Admin";

    const inspectionData = {
      workDateISO: savedDate,
      createdDate: savedDate,
      createdWeekday: savedWeekday,
      createdTime: savedTime,
      createdDateText: savedDateText,
      createdDateTimeText: savedDateTimeText,
      employeeId: sessionData.employeeId || sessionData.id || "",
      employeeName: employeeName,
      areaId: area.workId || area.areaId || area.id || "",
      areaDocId: area.id || "",
      areaName: area.areaName || "",
      roomKey: getRoomKey(area.areaName || ""),
      category: area.category || "",
      schedule: getAreaAssignment(area) || "",
      scheduleDay: area.scheduleDay || area.day || "",
      inspectionItemId: item.id || "",
      inspectionItem: item.inspectionItem || "",
      inspectionItemKey: item.inspectionItemKey || makeId(item.inspectionItem || item.id || ""),
      result: result,
      failReason: result === "Fail" ? failReason : "",
      note: noteBox ? noteBox.value.trim() : "",
      materialsNeeded: materialsNeededText,
      urgency: selectedMaintenanceUrgency || "",
      residentStatus: selectedMaintenanceResidentStatus || getMaintenanceAreaResidentStatus(area),
      allowPictures: item.allowPictures === true,
      photoCount: 0,
      photoUrls: [],
      openIssue: result === "Fail",
      reinspectionOfIssueId: maintenanceReinspectIssueId || "",
      reinspectionOfInspectionId: maintenanceReinspectInspectionId || "",
      openStatus: result === "Fail" ? "Open" : "Resolved",
      status: result === "Fail" ? "Open" : "Good",
      workflowStatus: workflowStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    showLoading();

    if (result === "Fail" && typedFailReason) {
      await saveNewMaintenanceInspectionFailReason(item, typedFailReason);
    }

    const inspectionRef = await addDoc(collection(db, "maintenance_inspections"), inspectionData);

    if (inspectionData.openIssue) {
      const existingIssue = await findOpenMaintenanceIssue(inspectionData.roomKey, inspectionData.inspectionItem);
      const issueData = {
        workDateISO: inspectionData.workDateISO,
        createdDate: inspectionData.createdDate,
        createdWeekday: inspectionData.createdWeekday,
        createdTime: inspectionData.createdTime,
        createdDateText: inspectionData.createdDateText,
        createdDateTimeText: inspectionData.createdDateTimeText,
        employeeId: inspectionData.employeeId,
        employeeName: inspectionData.employeeName,
        areaId: inspectionData.areaId,
        areaDocId: inspectionData.areaDocId,
        areaName: inspectionData.areaName,
        roomKey: inspectionData.roomKey,
        category: "Maintenance Inspection",
        schedule: inspectionData.schedule,
        taskName: inspectionData.inspectionItem,
        issueReason: inspectionData.failReason,
        issueNote: inspectionData.note,
        materialsNeeded: inspectionData.materialsNeeded,
        urgency: inspectionData.urgency,
        residentStatus: inspectionData.residentStatus,
        source: "maintenance_inspection",
        sourceInspectionId: inspectionRef.id,
        status: "Open",
        workflowStatus: workflowStatus,
        needsFollowUp: true,
        photoCount: 0,
        updatedAt: serverTimestamp()
      };

      if (existingIssue) {
        await updateDoc(doc(db, "issue_logs", existingIssue.id), issueData);
      } else {
        await addDoc(collection(db, "issue_logs"), {
          ...issueData,
          createdAt: serverTimestamp()
        });
      }
    } else {
      await resolveOpenMaintenanceIssues(inspectionData.roomKey, inspectionData.inspectionItem, inspectionData.note);
    }

    resetMaintenanceInspectionForm();

    hideLoading();
  }

  async function saveNewMaintenanceInspectionFailReason(item, failReason) {
    const cleanReason = String(failReason || "").trim();
    if (!item || !item.id || !cleanReason) return;

    const existingReasons = getMaintenanceInspectionFailReasons(item).map(function(reason) {
      return String(reason || "").trim().toLowerCase();
    });

    if (existingReasons.includes(cleanReason.toLowerCase())) {
      return;
    }

    await updateDoc(doc(db, "maintenance_inspection_items", item.id), {
      failReasons: arrayUnion(cleanReason),
      updatedAt: serverTimestamp()
    });

    if (!Array.isArray(item.failReasons)) {
      item.failReasons = [];
    }

    item.failReasons.push(cleanReason);
  }

  async function loadMaintenanceInspectionRecords() {
    try {
      const snap = await getDocs(collection(db, "maintenance_inspections"));
      allMaintenanceInspectionRecords = snap.docs.map(function(recordDoc) {
        return {
          id: recordDoc.id,
          ...recordDoc.data()
        };
      });
      return;
    } catch (error) {
      console.warn("maintenance_inspections read failed, using issue_logs fallback", error);
    }

    try {
      const issueSnap = await getDocs(collection(db, "issue_logs"));
      allMaintenanceInspectionRecords = issueSnap.docs
        .map(function(issueDoc) {
          return {
            id: issueDoc.id,
            ...issueDoc.data()
          };
        })
        .filter(function(issue) {
          return issue.source === "maintenance_inspection" ||
            issue.category === "Maintenance Inspection";
        })
        .map(function(issue) {
          return {
            id: issue.sourceInspectionId || issue.id,
            workDateISO: issue.workDateISO || issue.createdDate || "",
            createdDate: issue.createdDate || issue.workDateISO || "",
            createdWeekday: issue.createdWeekday || "",
            createdTime: issue.createdTime || "",
            createdDateText: issue.createdDateText || "",
            createdDateTimeText: issue.createdDateTimeText || "",
            employeeId: issue.employeeId || "",
            employeeName: issue.employeeName || "",
            areaId: issue.areaId || "",
            areaDocId: issue.areaDocId || "",
            areaName: issue.areaName || "",
            roomKey: issue.roomKey || getRoomKey(issue.areaName || ""),
            category: "Maintenance Inspection",
            schedule: issue.schedule || "",
            inspectionItemId: issue.taskId || "",
            inspectionItem: issue.taskName || "Inspection",
            result: "Fail",
            failReason: issue.issueReason || "",
            note: issue.issueNote || "",
            materialsNeeded: issue.materialsNeeded || "",
            urgency: issue.urgency || "",
            residentStatus: issue.residentStatus || "",
            workflowStatus: issue.workflowStatus || "",
            openStatus: issue.status || "Open",
            status: issue.status || "Open",
            sourceIssueId: issue.id,
            updatedAt: issue.updatedAt || issue.createdAt || null,
            createdAt: issue.createdAt || null
          };
        })
        .filter(function(record) {
          return record.sourceIssueId;
        });
    } catch (fallbackError) {
      console.error("Maintenance inspection fallback read failed", fallbackError);
      allMaintenanceInspectionRecords = allMaintenanceInspectionRecords || [];
    }
  }

  async function loadMaintenanceManualMaterials() {
    const snap = await getDocs(collection(db, "maintenance_material_entries"));
    allMaintenanceManualMaterials = snap.docs.map(function(recordDoc) {
      return {
        id: recordDoc.id,
        ...recordDoc.data()
      };
    }).filter(function(item) {
      return item.active !== false;
    });
  }

  async function openMaintenanceInspectionReport() {
    if (!requirePermission("maintenanceInspection")) return;
    showLoading();
    try {
      const datePicker = document.getElementById("maintenanceReportDatePicker");
      const typeSelect = document.getElementById("maintenanceReportTypeSelect");
      const searchInput = document.getElementById("maintenanceReportSearchInput");

      if (datePicker && !datePicker.value) datePicker.value = currentWorkDateISO || getTodayISO();
      if (typeSelect && !typeSelect.value) typeSelect.value = "All";

      updateAssignmentTitles();
      showAdminView("adminMaintenanceReportView");
      if (searchInput) {
        searchInput.oninput = handleMaintenanceInspectionReportInput;
        searchInput.onkeyup = handleMaintenanceInspectionReportInput;
        searchInput.onchange = refreshMaintenanceInspectionReport;
      }
      await loadMaintenanceInspectionRecords();
      drawMaintenanceInspectionReport();
      if (searchInput) searchInput.focus();
    } catch (error) {
      console.error("Inspection report failed", error);
      showAppMessage("Could not open inspection report. Try again.");
    } finally {
      hideLoading();
    }
  }

  function getMaintenanceInspectionRecordSearchText(record) {
    return [
      record.id,
      record.roomKey,
      record.areaName,
      record.areaId,
      record.areaDocId,
      record.schedule,
      record.category,
      record.inspectionItem
    ].join(" ").toLowerCase();
  }

  function maintenanceInspectionRecordMatchesSearch(record, searchText) {
    const searchRoomKey = getRoomKey(searchText);
    const recordRoomKeys = [
      record.roomKey,
      record.areaName,
      record.areaId,
      record.areaDocId,
      record.id
    ].map(function(value) {
      return getRoomKey(value || "");
    }).filter(function(value) {
      return value !== "";
    });

    return recordRoomKeys.includes(searchRoomKey) ||
      getMaintenanceInspectionRecordSearchText(record).includes(searchText);
  }

  function getMaintenanceInspectionReportDateISO(record) {
    const directDate = String(record.workDateISO || record.createdDate || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(directDate)) return directDate;

    const millis = getTimestampMillis(record);
    if (!millis) return directDate;

    const date = new Date(millis);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return yyyy + "-" + mm + "-" + dd;
  }

  function drawMaintenanceInspectionReport() {
    try {
      const box = document.getElementById("maintenanceReportList");
      const searchInput = document.getElementById("maintenanceReportSearchInput");
      const datePicker = document.getElementById("maintenanceReportDatePicker");
      const typeSelect = document.getElementById("maintenanceReportTypeSelect");
      const searchText = String(searchInput ? searchInput.value : "").trim().toLowerCase();
      const selectedDate = datePicker && datePicker.value ? datePicker.value : currentWorkDateISO;
      const reportType = typeSelect ? typeSelect.value : "All";

      if (!box) return;

      if (!searchText) {
        box.innerHTML = '<div class="room-report-card">Type a room or area.</div>';
        return;
      }

      let records = allMaintenanceInspectionRecords.filter(function(record) {
        const roomMatches = maintenanceInspectionRecordMatchesSearch(record, searchText);
        const dateMatches = getMaintenanceInspectionReportDateISO(record) === selectedDate;
        if (!roomMatches || !dateMatches) return false;

        const result = String(record.result || "").toLowerCase();
        const openStatus = String(record.openStatus || record.status || "").toLowerCase();
        const workflowStatus = getMaintenanceWorkflowStatus(record);

        if (reportType === "Failed") return result === "fail";
        if (reportType === "Passed") return workflowStatus === "Passed";
        if (reportType === "Open") return result === "fail" && openStatus !== "resolved";
        if (reportType !== "All") return workflowStatus === reportType;
        return true;
      }).sort(function(a, b) {
        return getMaintenanceInspectionRecordSortValue(b) - getMaintenanceInspectionRecordSortValue(a);
      });

      if (records.length === 0) {
        box.innerHTML = '<div class="room-report-card">No inspection records found.</div>';
        return;
      }

      box.innerHTML = records.map(function(record) {
        try {
          return buildMaintenanceInspectionReportCard(record);
        } catch (cardError) {
          console.error("Inspection report card failed", cardError, record);
          return buildMaintenanceInspectionFallbackCard(record);
        }
      }).join("");
    } catch (error) {
      console.error("Inspection report draw failed", error);
      const box = document.getElementById("maintenanceReportList");
      if (box) box.innerHTML = '<div class="room-report-card">Could not show inspection records.</div>';
    }
  }

  function getMaintenanceInspectionRecordSortValue(record) {
    const directSortValue = getRecordSortValue(record);
    if (directSortValue) return directSortValue;

    const dateTimeText = String(
      record.createdDateTimeText ||
      record.completedDateTimeText ||
      record.savedDateTimeText ||
      ""
    ).trim();

    if (dateTimeText) {
      const normalizedDateTime = dateTimeText.replace(/^[A-Za-z]+\s+/, "").replace(" - ", " ");
      const parsedDateTime = Date.parse(normalizedDateTime);
      if (!Number.isNaN(parsedDateTime)) return parsedDateTime;
    }

    const dateText = String(record.createdDate || record.workDateISO || record.savedDate || "").trim();
    const timeText = String(record.createdTime || record.savedTime || record.completedTime || "00:00").trim();
    const parsedFallback = Date.parse((dateText || "1900-01-01") + " " + timeText);
    return Number.isNaN(parsedFallback) ? 0 : parsedFallback;
  }

  function handleMaintenanceInspectionReportInput() {
    drawMaintenanceInspectionReport();

    if (maintenanceReportRefreshTimer) {
      clearTimeout(maintenanceReportRefreshTimer);
    }

    const searchInput = document.getElementById("maintenanceReportSearchInput");
    const searchText = String(searchInput ? searchInput.value : "").trim();
    if (searchText.length < 2) return;

    maintenanceReportRefreshTimer = setTimeout(function() {
      refreshMaintenanceInspectionReport();
    }, 250);
  }

  async function refreshMaintenanceInspectionReport() {
    showLoading();
    try {
      await loadMaintenanceInspectionRecords();
      drawMaintenanceInspectionReport();
    } catch (error) {
      console.error("Inspection report refresh failed", error);
      showAppMessage("Could not load inspection records.");
    } finally {
      hideLoading();
    }
  }

  function buildMaintenanceInspectionReportCard(record) {
    const result = String(record.result || "").toLowerCase() === "fail" ? "FAIL" : "GOOD";
    const openStatus = String(record.openStatus || record.status || (result === "FAIL" ? "Open" : "Resolved"));
    const isOpen = result === "FAIL" && openStatus !== "Resolved";
    const workflowStatus = getMaintenanceWorkflowStatus(record);
    const dateText = record.createdDateTimeText || getRecordDateTimeText(record);
    const issueParts = [];

    if (record.failReason) issueParts.push("Reason: " + record.failReason);
    if (record.note) issueParts.push("Notes: " + record.note);
    if (record.materialsNeeded) issueParts.push("Materials: " + record.materialsNeeded);

    return '' +
      '<div class="room-report-card">' +
        '<div class="maintenance-status-pill">' + escapeHtml(workflowStatus) + '</div>' +
        '<h3>' + escapeHtml(record.areaName || record.roomKey || "Area") + ' - ' + escapeHtml(record.inspectionItem || "Inspection") + '</h3>' +
        '<div>Status: ' + escapeHtml(result) + (record.urgency ? ' - ' + escapeHtml(record.urgency) : '') + '</div>' +
        '<div>Resident: ' + escapeHtml(record.residentStatus || "Occupied") + '</div>' +
        '<div>Saved: ' + escapeHtml(dateText) + '</div>' +
        '<div>Employee: ' + escapeHtml(record.employeeName || "Admin") + '</div>' +
        '<div>Open / Resolved: ' + escapeHtml(openStatus) + '</div>' +
        (issueParts.length ? '<div>' + escapeHtml(issueParts.join(" | ")) + '</div>' : '') +
        (isOpen ? '<button class="yellow" onclick="reinspectMaintenanceIssue(\'' + escapeHtml(record.id) + '\')">RE-INSPECT</button>' : '') +
      '</div>';
  }

  function buildMaintenanceInspectionFallbackCard(record) {
    return '' +
      '<div class="room-report-card">' +
        '<h3>' + escapeHtml(record.areaName || record.roomKey || "Inspection") + '</h3>' +
        '<div>Status: ' + escapeHtml(getMaintenanceWorkflowStatus(record)) + '</div>' +
        '<div>Item: ' + escapeHtml(record.inspectionItem || record.taskName || "Inspection") + '</div>' +
        '<div>Saved: ' + escapeHtml(record.createdDateTimeText || record.createdDate || record.workDateISO || "") + '</div>' +
        '<div>Employee: ' + escapeHtml(record.employeeName || "Admin") + '</div>' +
      '</div>';
  }

  async function reinspectMaintenanceIssue(recordId) {
    const record = allMaintenanceInspectionRecords.find(function(item) {
      return item.id === recordId;
    });

    if (!record) return;

    const openIssue = await findOpenMaintenanceIssue(getRoomKey(record.roomKey || record.areaName || ""), record.inspectionItem);

    await openMaintenanceInspection();

    maintenanceReinspectInspectionId = record.id;
    maintenanceReinspectIssueId = openIssue ? openIssue.id : "";

    const searchInput = document.getElementById("maintenanceInspectionSearchInput");
    if (searchInput) searchInput.value = record.areaName || record.roomKey || "";
    drawMaintenanceInspectionAreaList();

    const itemSelect = document.getElementById("maintenanceInspectionItemSelect");
    if (itemSelect) {
      const foundItem = allMaintenanceInspectionItems.find(function(item) {
        return item.id === record.inspectionItemId ||
          String(item.inspectionItem || "").trim().toLowerCase() === String(record.inspectionItem || "").trim().toLowerCase();
      });
      if (foundItem) {
        itemSelect.value = foundItem.id;
        changeMaintenanceInspectionItem();
      }
    }

    selectMaintenanceInspectionReason(record.failReason || "");
    selectMaintenanceInspectionMaterial(record.materialsNeeded || "");
    selectedMaintenanceResidentStatus = record.residentStatus === "Vacant" ? "Vacant" : "Occupied";
    selectedMaintenanceUrgency = record.urgency || "";
    updateMaintenanceResidentButtons();
    updateMaintenanceUrgencyButtons();

    const noteBox = document.getElementById("maintenanceInspectionNoteInput");
    if (noteBox) noteBox.value = record.note || "";
  }

  async function openMaintenanceMaterialsNeeded() {
    if (!requirePermission("materialsNeeded")) return;
    showLoading();
    try {
      await loadMaintenanceInspectionRecords();
      await loadMaintenanceManualMaterials();
      drawMaintenanceMaterialsNeeded();
      updateAssignmentTitles();
      showAdminView("adminMaintenanceMaterialsView");
    } finally {
      hideLoading();
    }
  }

  function drawMaintenanceMaterialsNeeded() {
    try {
      const box = document.getElementById("maintenanceMaterialsNeededList");
      if (!box) return;

      const failedMaterials = allMaintenanceInspectionRecords.filter(function(record) {
        const workflowStatus = getMaintenanceWorkflowStatus(record);
        return workflowStatus === "Needs Material" &&
          String(record.materialsNeeded || "").trim();
      }).map(function(record) {
        return {
          id: record.id || "",
          urgency: record.urgency || "",
          room: record.areaName || record.roomKey || "",
          material: record.materialsNeeded || "",
          reason: record.failReason || "",
          note: record.note || "",
          sortValue: getMaintenanceInspectionRecordSortValue(record),
          source: "Inspection"
        };
      });

      const manualMaterials = allMaintenanceManualMaterials.map(function(item) {
        return {
          id: item.id || "",
          urgency: item.urgency || "",
          room: item.room || item.areaName || "",
          material: item.material || "",
          reason: item.reason || item.note || "",
          note: item.note || item.reason || "",
          sortValue: getMaintenanceInspectionRecordSortValue(item),
          source: "Manual"
        };
      });

      const materials = failedMaterials.concat(manualMaterials).sort(function(a, b) {
        return (b.sortValue || 0) - (a.sortValue || 0);
      });

      if (materials.length === 0) {
        box.innerHTML = '<div class="room-report-card">No materials needed.</div>';
        return;
      }

      box.innerHTML = materials.map(function(item) {
        return '' +
          '<div class="room-report-card">' +
            '<h3>' + escapeHtml(item.material || "Material") + '</h3>' +
            '<div>Urgency: ' + escapeHtml(item.urgency || "None") + '</div>' +
            '<div>For: ' + escapeHtml(item.room || "Stock") + '</div>' +
            '<div>Note: ' + escapeHtml(item.note || item.reason || "None") + '</div>' +
            '<div>Source: ' + escapeHtml(item.source) + '</div>' +
            (item.source === "Manual" && item.id ? '<button class="green" onclick="markMaintenanceManualMaterialBought(\'' + escapeHtml(item.id) + '\')">BOUGHT</button>' : '') +
          '</div>';
      }).join("");
    } finally {
      // Keep draw safe when called after a loading refresh.
    }
  }

  /* =========================
     44F - PTAC
  ========================== */

  function getPtacRoomKey(value) {
    return String(value || "").trim();
  }

  function getPtacStatus(record) {
    return String(record?.ptacStatus || record?.status || record?.label || "").trim();
  }

  function getPtacNotes(record) {
    return String(record?.ptacNotes || record?.notes || record?.note || "").trim();
  }

  function getPtacEmployee(record) {
    return String(record?.employee || record?.employeeName || record?.user || "").trim();
  }

  function getSessionEmployeeName() {
    const first = String(sessionData.firstName || "").trim();
    const last = String(sessionData.lastName || "").trim();
    return String(sessionData.employeeName || sessionData.name || (first + " " + last).trim() || "Employee").trim();
  }

  function formatPtacDateText(isoDate) {
    const cleanDate = String(isoDate || getTodayISO()).slice(0, 10);
    const parts = cleanDate.split("-");
    if (parts.length !== 3) return cleanDate;
    return parts[1] + "/" + parts[2] + "/" + parts[0];
  }

  function getPtacTimestampText(dateObj) {
    const date = dateObj || new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return mm + "/" + dd + "/" + yyyy + " " + hours + ":" + minutes;
  }

  function parsePtacDateValue(value) {
    if (!value) return "";
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString().slice(0, 10);
    }

    const text = String(value || "").trim();
    if (!text) return "";

    const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];

    const us = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) {
      return us[3] + "-" + String(us[1]).padStart(2, "0") + "-" + String(us[2]).padStart(2, "0");
    }

    return "";
  }

  function getPtacRecordDateISO(record) {
    return String(record?.workDateISO || record?.createdDate || "").slice(0, 10)
      || parsePtacDateValue(record?.dateText)
      || parsePtacDateValue(record?.date)
      || parsePtacDateValue(record?.timestampText)
      || parsePtacDateValue(record?.createdAt);
  }

  function getPtacRecordTimeValue(record) {
    const direct = record?.createdAt || record?.updatedAt;
    if (direct && typeof direct.toDate === "function") return direct.toDate().getTime();

    const text = String(record?.timestampText || record?.uploadedAtText || record?.dateText || "").trim();
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return parsed;

    const iso = getPtacRecordDateISO(record);
    return iso ? new Date(iso + "T00:00:00").getTime() : 0;
  }

  function sortPtacNewestFirst(records) {
    return records.slice().sort(function(a, b) {
      return getPtacRecordTimeValue(b) - getPtacRecordTimeValue(a);
    });
  }

  function getPtacShortDate(record) {
    const iso = getPtacRecordDateISO(record);
    if (!iso) return "";
    const parts = iso.split("-");
    return parts.length === 3 ? parts[1] + "/" + parts[2] : iso;
  }

  function getLatestPtacRecordsByRoom() {
    const latest = {};
    sortPtacNewestFirst(allPtacRecords).forEach(function(record) {
      const room = getPtacRoomKey(record.room || record.roomKey || record.areaName);
      if (room && !latest[room]) latest[room] = record;
    });
    return latest;
  }

  async function loadPtacRecords() {
    const snap = await getDocs(collection(db, "ptac"));
    allPtacRecords = snap.docs.map(function(ptacDoc) {
      return {
        id: ptacDoc.id,
        ...ptacDoc.data()
      };
    });
  }

  async function openPtacDashboard() {
    if (!requirePermission("ptac")) return;
    showLoading();
    try {
      await loadPtacRecords();
      drawPtacDashboard();
      updateAssignmentTitles();
      showAdminView("adminPtacDashboardView");
    } finally {
      hideLoading();
    }
  }

  function drawPtacDashboard() {
    const latest = getLatestPtacRecordsByRoom();
    let replaceCount = 0;
    let brokenCount = 0;
    let notesCount = 0;

    Object.keys(latest).forEach(function(room) {
      const status = getPtacStatus(latest[room]);
      if (status === "Replace") replaceCount++;
      if (status === "Broken") brokenCount++;
      if (status !== "Reset" && getPtacNotes(latest[room])) notesCount++;
    });

    [1, 2, 3].forEach(function(floor) {
      const rooms = PTAC_ROOM_LIST[floor] || [];
      const untouched = rooms.filter(function(room) {
        const status = getPtacStatus(latest[room]);
        return !status || status === "Reset";
      }).length;
      const suffix = floor === 1 ? "st" : floor === 2 ? "nd" : "rd";
      const btn = document.getElementById("ptacFloorButton" + floor);
      if (btn) btn.innerText = "(" + rooms.length + ") " + floor + suffix + " Floor (" + untouched + ")";
    });

    const notesButton = document.getElementById("ptacNotesButton");
    const replaceButton = document.getElementById("ptacReplaceButton");
    const brokenButton = document.getElementById("ptacBrokenButton");
    if (notesButton) notesButton.innerText = "VIEW ALL NOTES (" + notesCount + ")";
    if (replaceButton) replaceButton.innerText = "REPLACE (" + replaceCount + ")";
    if (brokenButton) brokenButton.innerText = "BROKEN (" + brokenCount + ")";
  }

  function handlePtacQuickSearch() {
    const input = document.getElementById("ptacRoomSearchInput");
    const room = getPtacRoomKey(input?.value);
    if (/^\d{3}$/.test(room)) {
      openPtacRoom(room);
      if (input) input.value = "";
    }
  }

  function openPtacRoomFromSearch() {
    const input = document.getElementById("ptacRoomSearchInput");
    const room = getPtacRoomKey(input?.value);
    if (!room) {
      showAppMessage("Type a room number.");
      return;
    }
    openPtacRoom(room);
    if (input) input.value = "";
  }

  function openPtacFloor(floor) {
    currentPtacFloor = String(floor);
    const rooms = PTAC_ROOM_LIST[floor] || [];
    const latest = getLatestPtacRecordsByRoom();
    const grid = document.getElementById("ptacRoomGrid");
    const title = document.getElementById("ptacFloorTitle");
    if (title) title.innerText = "Floor " + floor;
    if (grid) {
      grid.innerHTML = rooms.map(function(room) {
        const record = latest[room] || {};
        const status = getPtacStatus(record);
        const className = status ? "ptac-status-" + status : "";
        const label = status && status !== "Reset"
          ? "<small>" + escapeHtml(status) + "</small><small>" + escapeHtml(getPtacShortDate(record)) + "</small>"
          : "";
        return "<button class=\"ptac-room-button " + className + "\" onclick=\"openPtacRoom('" + escapeHtml(room) + "')\"><strong>" + escapeHtml(room) + "</strong>" + label + "</button>";
      }).join("");
    }
    updateAssignmentTitles();
    showAdminView("adminPtacRoomsView");
  }

  function openPtacRoom(room) {
    currentPtacRoom = getPtacRoomKey(room);
    const title = document.getElementById("ptacRoomTitle");
    const dateInput = document.getElementById("ptacManualDate");
    const notesInput = document.getElementById("ptacNotesInput");
    if (title) title.innerText = currentPtacRoom;
    if (dateInput && !dateInput.value) dateInput.value = getTodayISO();
    if (notesInput) notesInput.value = "";
    updateAssignmentTitles();
    showAdminView("adminPtacRoomView");
  }

  async function savePtacStatus(status) {
    if (!currentPtacRoom) {
      showAppMessage("Choose a room first.");
      return;
    }

    const noteInput = document.getElementById("ptacNotesInput");
    const dateInput = document.getElementById("ptacManualDate");
    const note = String(noteInput?.value || "").trim();
    const workDateISO = String(dateInput?.value || getTodayISO()).slice(0, 10);

    if (status === "Broken" && !note) {
      showAppMessage("Please enter a note explaining why this unit is broken.");
      return;
    }

    showLoading();
    try {
      const now = new Date();
      await addDoc(collection(db, "ptac"), {
        room: currentPtacRoom,
        roomKey: currentPtacRoom,
        areaName: currentPtacRoom,
        ptacStatus: status,
        ptacNotes: note,
        employee: getSessionEmployeeName(),
        employeeId: sessionData.employeeId || sessionData.id || "",
        employeeName: getSessionEmployeeName(),
        workDateISO: workDateISO,
        weekday: getWeekdayName(workDateISO),
        dateText: formatPtacDateText(workDateISO) + " 00:00",
        timestampText: getPtacTimestampText(now),
        sourceSheet: "Ptac",
        source: "admin_ptac",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (noteInput) noteInput.value = "";
      if (dateInput) dateInput.value = getTodayISO();
      await loadPtacRecords();
      drawPtacDashboard();
      showAppMessage("Room " + currentPtacRoom + " updated.");
      showAdminView("adminPtacDashboardView");
    } finally {
      hideLoading();
    }
  }

  function confirmPtacReset() {
    if (!currentPtacRoom) return;
    showAppConfirmMessage("Reset visible PTAC status for room " + currentPtacRoom + "?", "Reset Room").then(function(confirmed) {
      if (confirmed) savePtacStatus("Reset");
    });
  }

  function openPtacHistory() {
    const title = document.getElementById("ptacHistoryTitle");
    const list = document.getElementById("ptacHistoryList");
    if (title) title.innerText = "Room " + currentPtacRoom + " History";

    const records = sortPtacNewestFirst(allPtacRecords).filter(function(record) {
      return getPtacRoomKey(record.room || record.roomKey || record.areaName) === currentPtacRoom;
    });

    if (list) {
      list.innerHTML = records.length
        ? records.map(renderPtacRecordCard).join("")
        : "<div class=\"ptac-list-card\"><p>No history found.</p></div>";
    }

    updateAssignmentTitles();
    showAdminView("adminPtacHistoryView");
  }

  function openPtacNotes() {
    const latest = getLatestPtacRecordsByRoom();
    const list = document.getElementById("ptacNotesList");
    const records = Object.keys(latest)
      .map(function(room) { return latest[room]; })
      .filter(function(record) {
        return getPtacStatus(record) !== "Reset" && getPtacNotes(record);
      })
      .sort(function(a, b) {
        return getPtacRecordTimeValue(b) - getPtacRecordTimeValue(a);
      });

    if (list) {
      list.innerHTML = records.length
        ? records.map(function(record) {
          const room = getPtacRoomKey(record.room || record.roomKey || record.areaName);
          return "<div class=\"ptac-list-card\"><h3>Room " + escapeHtml(room) + "</h3><p>" + escapeHtml(getPtacNotes(record)) + "</p><p>Updated: " + escapeHtml(getPtacShortDate(record)) + "</p><button class=\"red\" onclick=\"confirmClearPtacNote('" + escapeHtml(record.id) + "')\">DELETE NOTE</button></div>";
        }).join("")
        : "<div class=\"ptac-list-card\"><p>No notes found.</p></div>";
    }

    updateAssignmentTitles();
    showAdminView("adminPtacNotesView");
  }

  function confirmClearPtacNote(recordId) {
    showAppConfirmMessage("Delete this PTAC note?", "Delete Note").then(async function(confirmed) {
      if (!confirmed) return;
      showLoading();
      try {
        await updateDoc(doc(db, "ptac", recordId), {
          ptacNotes: "",
          notes: "",
          updatedAt: serverTimestamp()
        });
        await loadPtacRecords();
        openPtacNotes();
      } finally {
        hideLoading();
      }
    });
  }

  function openPtacQueue(status) {
    currentPtacQueueStatus = status;
    const latest = getLatestPtacRecordsByRoom();
    const records = Object.keys(latest)
      .map(function(room) { return latest[room]; })
      .filter(function(record) {
        return getPtacStatus(record) === status;
      })
      .sort(function(a, b) {
        return getPtacRecordTimeValue(b) - getPtacRecordTimeValue(a);
      });

    const title = document.getElementById("ptacQueueTitle");
    const list = document.getElementById("ptacQueueList");
    if (title) title.innerText = "PTAC " + status;
    if (list) {
      list.innerHTML = records.length
        ? records.map(renderPtacRecordCard).join("")
        : "<div class=\"ptac-list-card\"><p>No " + escapeHtml(status) + " rooms.</p></div>";
    }

    updateAssignmentTitles();
    showAdminView("adminPtacQueueView");
  }

  function renderPtacRecordCard(record) {
    const room = getPtacRoomKey(record.room || record.roomKey || record.areaName);
    const status = getPtacStatus(record) || "No status";
    const note = getPtacNotes(record) || "No notes";
    const employee = getPtacEmployee(record) || "No employee";
    const dateText = getPtacRecordDateISO(record) ? formatDateWithWeekday(getPtacRecordDateISO(record)) : "No date";
    return "<div class=\"ptac-list-card\"><h3>Room " + escapeHtml(room) + "</h3><p>Status: " + escapeHtml(status) + "</p><p>Date: " + escapeHtml(dateText) + "</p><p>Employee: " + escapeHtml(employee) + "</p><p>Notes: " + escapeHtml(note) + "</p><button onclick=\"openPtacRoom('" + escapeHtml(room) + "')\">OPEN ROOM</button></div>";
  }



  function getMaintenanceKnownMaterials() {
    const map = {};

    allMaintenanceInspectionItems.forEach(function(item) {
      getMaintenanceInspectionMaterials(item).forEach(function(material) {
        const cleanMaterial = String(material || "").trim();
        if (cleanMaterial) map[cleanMaterial.toLowerCase()] = cleanMaterial;
      });
    });

    allMaintenanceInspectionRecords.forEach(function(record) {
      const cleanMaterial = String(record.materialsNeeded || "").trim();
      if (cleanMaterial) map[cleanMaterial.toLowerCase()] = cleanMaterial;
    });

    allMaintenanceManualMaterials.forEach(function(item) {
      const cleanMaterial = String(item.material || "").trim();
      if (cleanMaterial) map[cleanMaterial.toLowerCase()] = cleanMaterial;
    });

    return Object.keys(map).sort().map(function(key) {
      return map[key];
    });
  }

  function fillMaintenanceManualMaterialSelect() {
    const select = document.getElementById("maintenanceManualMaterialSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Choose material</option>';
    getMaintenanceKnownMaterials().forEach(function(material) {
      const option = document.createElement("option");
      option.value = material;
      option.innerText = material;
      select.appendChild(option);
    });
  }

  function fillMaintenanceManualMaterialAreaSelect() {
    const select = document.getElementById("maintenanceManualMaterialAreaSelect");
    if (!select) return;

    select.innerHTML = '<option value="">Choose area</option>';
    getMaintenanceStartAreaChoices().forEach(function(area) {
      const option = document.createElement("option");
      option.value = area.areaName;
      option.innerText = area.areaName;
      select.appendChild(option);
    });
  }

  async function openMaintenanceManualMaterialPopup() {
    showLoading();
    try {
      if (allAreas.length === 0) await loadAllAdminData();
      if (allMaintenanceInspectionItems.length === 0) await loadMaintenanceInspectionItems();
      await loadMaintenanceInspectionRecords();
      await loadMaintenanceManualMaterials();

      maintenanceManualMaterialLocationType = "general";
      fillMaintenanceManualMaterialSelect();
      fillMaintenanceManualMaterialAreaSelect();

      const materialInput = document.getElementById("maintenanceManualMaterialInput");
      const roomInput = document.getElementById("maintenanceManualMaterialRoomInput");
      const areaSelect = document.getElementById("maintenanceManualMaterialAreaSelect");
      const noteBox = document.getElementById("maintenanceManualMaterialNote");
      const materialSelect = document.getElementById("maintenanceManualMaterialSelect");
      const popup = document.getElementById("maintenanceManualMaterialPopup");

      if (materialInput) materialInput.value = "";
      if (roomInput) roomInput.value = "";
      if (areaSelect) areaSelect.value = "";
      if (noteBox) noteBox.value = "";
      if (materialSelect) materialSelect.value = "";
      selectMaintenanceManualMaterialLocation("general");
      if (popup) popup.classList.remove("hidden");
    } finally {
      hideLoading();
    }
  }

  function selectMaintenanceManualMaterialLocation(type) {
    maintenanceManualMaterialLocationType = ["room", "area"].includes(type) ? type : "general";

    const roomInput = document.getElementById("maintenanceManualMaterialRoomInput");
    const areaSelect = document.getElementById("maintenanceManualMaterialAreaSelect");

    if (roomInput) roomInput.classList.toggle("hidden", maintenanceManualMaterialLocationType !== "room");
    if (areaSelect) areaSelect.classList.toggle("hidden", maintenanceManualMaterialLocationType !== "area");
  }

  async function confirmMaintenanceManualMaterialPopup() {
    const materialSelect = document.getElementById("maintenanceManualMaterialSelect");
    const materialInput = document.getElementById("maintenanceManualMaterialInput");
    const roomInput = document.getElementById("maintenanceManualMaterialRoomInput");
    const areaSelect = document.getElementById("maintenanceManualMaterialAreaSelect");
    const noteBox = document.getElementById("maintenanceManualMaterialNote");

    const typedMaterial = String(materialInput ? materialInput.value : "").trim();
    const selectedMaterial = String(materialSelect ? materialSelect.value : "").trim();
    const material = typedMaterial || selectedMaterial;
    const roomValue = String(roomInput ? roomInput.value : "").replace(/\D/g, "").slice(0, 3);
    const areaValue = String(areaSelect ? areaSelect.value : "").trim();
    const note = String(noteBox ? noteBox.value : "").trim();

    if (!material) {
      showAppMessage("Choose or type material.");
      return;
    }

    let locationText = "Stock";
    if (maintenanceManualMaterialLocationType === "room") {
      if (!roomValue) {
        showAppMessage("Type room number.");
        return;
      }
      locationText = roomValue;
    }
    if (maintenanceManualMaterialLocationType === "area") {
      if (!areaValue) {
        showAppMessage("Choose area.");
        return;
      }
      locationText = areaValue;
    }

    showLoading();
    try {
      await addDoc(collection(db, "maintenance_material_entries"), {
        material: material,
        room: locationText,
        areaName: locationText,
        locationType: maintenanceManualMaterialLocationType,
        urgency: "",
        reason: note,
        note: note,
        source: "manual",
        active: true,
        createdBy: sessionData.name || sessionData.employeeName || "Admin",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      cancelMaintenanceManualMaterialPopup();
      await openMaintenanceMaterialsNeeded();
    } finally {
      hideLoading();
    }
  }

  function cancelMaintenanceManualMaterialPopup() {
    const popup = document.getElementById("maintenanceManualMaterialPopup");
    if (popup) popup.classList.add("hidden");
  }

  async function markMaintenanceManualMaterialBought(materialId) {
    if (!materialId) return;

    const ok = await showAppConfirmMessage("Mark this material as bought?");
    if (!ok) return;

    showLoading();
    try {
      await updateDoc(doc(db, "maintenance_material_entries", materialId), {
        active: false,
        boughtBy: sessionData.name || sessionData.employeeName || "Admin",
        boughtAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await openMaintenanceMaterialsNeeded();
    } finally {
      hideLoading();
    }
  }

  /* =========================
     44B - EMPLOYEE PERMISSION HELPERS
  ========================== */

  const EMPLOYEE_PERMISSION_FIELDS = [
    { id: "empCanViewHousekeeping", flat: "canViewHousekeeping", nested: "housekeeping" },
    { id: "empCanViewLaundry", flat: "canViewLaundry", nested: "laundry" },
    { id: "empCanViewPTAC", flat: "canViewPTAC", nested: "ptac" },
    { id: "empCanViewMaintenanceInspection", flat: "canViewMaintenanceInspection", nested: "maintenanceInspection" },
    { id: "empCanViewMaintenanceWorkBoard", flat: "canViewMaintenanceWorkBoard", nested: "maintenanceWorkBoard" },
    { id: "empCanViewMaterialsNeeded", flat: "canViewMaterialsNeeded", nested: "materialsNeeded" },
    { id: "empCanViewReports", flat: "canViewReports", nested: "reports" },
    { id: "empCanViewActivityHistory", flat: "canViewActivityHistory", nested: "activityHistory" },
    { id: "empCanViewAdminDashboard", flat: "canViewAdminDashboard", nested: "adminDashboard" },
    { id: "empCanEditEmployees", flat: "canEditEmployees", nested: "editEmployees" },
    { id: "empCanEditSchedules", flat: "canEditSchedules", nested: "editSchedules" },
    { id: "empCanEditRoomSettings", flat: "canEditRoomSettings", nested: "editRoomSettings" },
    { id: "empCanEditIssueReasons", flat: "canEditIssueReasons", nested: "editIssueReasons" },
    { id: "empCanViewDailyStatus", flat: "canViewDailyStatus", nested: "dailyStatus" },
    { id: "empCanViewIssues", flat: "canViewIssues", nested: "issues" },
    { id: "empCanChangeScheduleMode", flat: "canChangeScheduleMode", nested: "changeScheduleMode" }
  ];


  function updateEmployeePermissionSelectColor(select) {
    if (!select) return;
    select.classList.toggle("permission-yes", select.value === "true");
    select.classList.toggle("permission-no", select.value === "false");
  }

  function updateEmployeePermissionSelectColors() {
    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      updateEmployeePermissionSelectColor(document.getElementById(field.id));
    });
  }

  function bindEmployeePermissionSelectColors() {
    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      const select = document.getElementById(field.id);
      if (!select || select.dataset.permissionColorBound === "true") return;
      select.dataset.permissionColorBound = "true";
      select.addEventListener("change", function() {
        updateEmployeePermissionSelectColor(select);
      });
      updateEmployeePermissionSelectColor(select);
    });
  }

  function getDefaultEmployeePermissions(roleValue, assignmentValue) {
    const roleText = String(roleValue || "").trim().toLowerCase();
    const assignmentText = String(assignmentValue || "").trim().toLowerCase();
    const isAdmin = roleText === "admin";
    const isHousekeepingOrLaundry = assignmentText === "housekeeping" || assignmentText === "laundry";

    const defaults = {};

    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      defaults[field.nested] = false;
    });

    if (isAdmin) {
      EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
        defaults[field.nested] = true;
      });
      return defaults;
    }

    if (isHousekeepingOrLaundry) {
      defaults.housekeeping = true;
      defaults.laundry = true;
    }

    return defaults;
  }

  function applyEmployeePermissionDefaultsFromInputs() {
    const roleValue = document.getElementById("empRole").value;
    const assignmentValue = document.getElementById("empAssignment").value;
    const defaults = getDefaultEmployeePermissions(roleValue, assignmentValue);

    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      const select = document.getElementById(field.id);
      if (!select) return;
      select.value = defaults[field.nested] ? "true" : "false";
      updateEmployeePermissionSelectColor(select);
    });
  }

  function getSavedEmployeePermission(emp, field, defaultValue) {
    const permissions = emp.permissions || {};

    if (emp[field.flat] === true || permissions[field.nested] === true) return true;
    if (emp[field.flat] === false || permissions[field.nested] === false) return false;

    const flatText = String(emp[field.flat] || "").trim().toLowerCase();
    const nestedText = String(permissions[field.nested] || "").trim().toLowerCase();

    if (flatText === "yes" || flatText === "true" || flatText === "1") return true;
    if (nestedText === "yes" || nestedText === "true" || nestedText === "1") return true;

    if (flatText === "no" || flatText === "false" || flatText === "0") return false;
    if (nestedText === "no" || nestedText === "false" || nestedText === "0") return false;

    return defaultValue === true;
  }

  function loadEmployeePermissionSelects(emp) {
    const defaults = getDefaultEmployeePermissions(emp.role || "", emp.assignment || "");

    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      const select = document.getElementById(field.id);
      if (!select) return;

      const savedValue = getSavedEmployeePermission(emp, field, defaults[field.nested]);
      select.value = savedValue ? "true" : "false";
      updateEmployeePermissionSelectColor(select);
    });
  }

  function getEmployeePermissionSaveData() {
    const permissions = {};
    const data = {};

    EMPLOYEE_PERMISSION_FIELDS.forEach(function(field) {
      const select = document.getElementById(field.id);
      const value = select && select.value === "true";

      permissions[field.nested] = value;
      data[field.flat] = value;
    });

    data.permissions = permissions;

    return data;
  }

  /* =========================
     45 - OPEN NEW EMPLOYEE
  ========================== */

  function openNewEmployee() {
    currentEmployeeId = "";
    document.getElementById("employeeEditTitle").innerText = "New Employee";
    document.getElementById("empFirstName").value = "";
    document.getElementById("empLastName").value = "";
    document.getElementById("empPin").value = "";
    document.getElementById("empAssignment").value = "";
    document.getElementById("empDefaultSchedule").value = "";
    document.getElementById("empRole").value = "";
    document.getElementById("empActive").value = "";
    applyEmployeePermissionDefaultsFromInputs();
    bindEmployeePermissionSelectColors();
    document.getElementById("employeeMessage").innerText = "";
    updateAssignmentTitles();
    showAdminView("adminEmployeeEditView");
  }

  /* =========================
     46 - OPEN EXISTING EMPLOYEE
  ========================== */

  function openEmployeeEditor(emp) {
    currentEmployeeId = emp.id;
    const name = ((emp.firstName || "") + " " + (emp.lastName || "")).trim() || emp.employeeName || emp.name || "Employee";

    document.getElementById("employeeEditTitle").innerText = name;
    document.getElementById("empFirstName").value = emp.firstName || "";
    document.getElementById("empLastName").value = emp.lastName || "";
    document.getElementById("empPin").value = emp.pin || "";
    document.getElementById("empAssignment").value = emp.assignment || "";
    document.getElementById("empDefaultSchedule").value = emp.defaultSchedule || emp.default_schedule || "";
    document.getElementById("empRole").value = emp.role || "";
    document.getElementById("empActive").value = emp.active === false ? "false" : "true";
    loadEmployeePermissionSelects(emp);
    bindEmployeePermissionSelectColors();
    document.getElementById("employeeMessage").innerText = "";

    updateAssignmentTitles();
    showAdminView("adminEmployeeEditView");
  }

  /* =========================
     47 - SAVE EMPLOYEE
  ========================== */

  async function saveEmployee() {
    const firstName = document.getElementById("empFirstName").value.trim();
    const lastName = document.getElementById("empLastName").value.trim();
    const pin = document.getElementById("empPin").value.trim();
    const assignment = document.getElementById("empAssignment").value;
    const defaultSchedule = document.getElementById("empDefaultSchedule").value;
    const role = document.getElementById("empRole").value;
    const activeValue = document.getElementById("empActive").value;

    if (!firstName || !pin || !assignment || !role || !activeValue) {
      alert("Fill first name, PIN, assignment, role, and active.");
      return;
    }

    const active = activeValue === "true";
    showLoading();

    const permissionData = getEmployeePermissionSaveData();

    const data = {
      firstName: firstName,
      lastName: lastName,
      pin: pin,
      assignment: assignment,
      defaultSchedule: defaultSchedule,
      role: role,
      active: active,
      ...permissionData,
      updatedAt: serverTimestamp()
    };

    if (currentEmployeeId) {
      await updateDoc(doc(db, "employees", currentEmployeeId), data);
    } else {
      data.createdAt = serverTimestamp();
      const newDoc = await addDoc(collection(db, "employees"), data);
      currentEmployeeId = newDoc.id;
    }

    hideLoading();
    document.getElementById("employeeMessage").innerText = "Saved.";
  }

  /* =========================
     48 - DELETE EMPLOYEE
  ========================== */

  async function deleteEmployee() {
    if (!currentEmployeeId) {
      openEmployees();
      return;
    }

    const ok = confirm("Delete this employee?");
    if (!ok) return;

    showLoading();
    await deleteDoc(doc(db, "employees", currentEmployeeId));
    hideLoading();
    openEmployees();
  }

  /* =========================
     48B - REASSIGNMENT
  ========================== */

  async function openReassignment() {
    reassignWorkDateISO = currentWorkDateISO;
    reassignWorkDayName = "";
    reassignTargetDayName = "";
    selectedReassignmentAreaId = "";
    updateReassignmentDropdownOptions(true);

    const roomSelect = document.getElementById("reassignmentAreaList");
    if (roomSelect) roomSelect.innerHTML = '<option value="">Select room</option>';

    const dehumidifierFrom = document.getElementById("dehumidifierFromRoomInput");
    const dehumidifierTo = document.getElementById("dehumidifierToRoomInput");
    if (dehumidifierFrom) dehumidifierFrom.value = "";
    if (dehumidifierTo) dehumidifierTo.value = "";

    const toPreview = document.getElementById("reassignmentToAreaPreview");
    const toPreviewLabel = document.getElementById("reassignToPreviewLabel");
    if (toPreview) toPreview.innerHTML = "";
    if (toPreviewLabel) toPreviewLabel.innerText = "";
    setReassignmentDateVisibility();
    showAdminView("adminReassignmentView");
  }

  function syncReassignmentCategoryView() {
    const category = document.getElementById("reassignCategory")?.value || "";
    const dehumidifierBox = document.getElementById("dehumidifierReassignmentBox");
    const genericBox = document.getElementById("genericReassignmentBox");

    const isDehumidifierMove = category === "Dehumidifier";

    if (dehumidifierBox) dehumidifierBox.classList.toggle("hidden", !isDehumidifierMove);
    if (genericBox) genericBox.classList.toggle("hidden", isDehumidifierMove);
  }

  function setReassignmentDateVisibility() {
    syncReassignmentCategoryView();

    const fromBox = document.getElementById("reassignFromDayBox");
    const toBox = document.getElementById("reassignToDayBox");
    const category = document.getElementById("reassignCategory")?.value || "";
    const showDays = isWeeklyCategory(category);

    if (category === "Dehumidifier") {
      reassignWorkDayName = "";
      reassignTargetDayName = "";
      if (fromBox) fromBox.classList.add("hidden");
      if (toBox) toBox.classList.add("hidden");
      updateReassignmentDateDisplay();
      return;
    }

    if (showDays) {
      if (!reassignWorkDayName) reassignWorkDayName = getWeekdayName(currentWorkDateISO);
      if (!reassignTargetDayName) reassignTargetDayName = reassignWorkDayName;
    } else {
      reassignWorkDayName = "";
      reassignTargetDayName = "";
    }

    if (fromBox) fromBox.classList.toggle("hidden", !showDays);
    if (toBox) toBox.classList.toggle("hidden", !showDays);

    updateReassignmentDateDisplay();
  }

  async function changeReassignmentFrom() {
    updateReassignmentDateDisplay();
    await loadReassignmentAreas();
  }

  function changeReassignmentTo() {
    updateReassignmentDateDisplay();
  }

  async function changeReassignmentCategory() {
    selectedReassignmentAreaId = "";
    setReassignmentDateVisibility();

    if (document.getElementById("reassignCategory").value === "Dehumidifier") {
      const roomSelect = document.getElementById("reassignmentAreaList");
      const toPreview = document.getElementById("reassignmentToAreaPreview");
      const toPreviewLabel = document.getElementById("reassignToPreviewLabel");
      if (roomSelect) roomSelect.innerHTML = '<option value="">Select room</option>';
      if (toPreview) toPreview.innerHTML = '<option value="">Select destination to preview rooms</option>';
      if (toPreviewLabel) toPreviewLabel.innerText = "";
      updateReassignmentDateDisplay();
      return;
    }

    await loadReassignmentAreas();
  }

  async function changeReassignmentDate() {
    updateReassignmentDateDisplay();
    await loadReassignmentAreas();
  }

  async function loadReassignmentAreas() {
    const fromAssignment = document.getElementById("reassignFrom").value;
    const category = document.getElementById("reassignCategory").value;
    const select = document.getElementById("reassignmentAreaList");

    selectedReassignmentAreaId = "";

    if (select) {
      select.innerHTML = '<option value="">Select room</option>';
    }

    if (!fromAssignment || !category) {
      updateReassignmentDateDisplay();
      return;
    }

    if (isWeeklyCategory(category) && !reassignWorkDayName) {
      updateReassignmentDateDisplay();
      return;
    }

    if (fromAssignment !== "Laundry" && (category === "Weekly Laundry" || category === "Daily Laundry")) {
      showAppMessage("Laundry categories only show when the selected schedule is Laundry.");
      return;
    }

    updateReassignmentDateDisplay();
    setReassignmentDateVisibility();
    showLoading();

    const areas = allAreas.filter(function(area) {
      return getAreaAssignment(area) === fromAssignment &&
        area.category === category &&
        (isWeeklyCategory(category) ? isAreaForReassignDay(area) : true);
    }).sort(function(a, b) {
      return String(a.areaName || "").localeCompare(String(b.areaName || ""), undefined, { numeric: true });
    });

    if (areas.length === 0) {
      const empty = document.createElement("option");
      empty.value = "";
      empty.innerText = isWeeklyCategory(category) ? "No rooms for " + reassignWorkDayName : "No rooms found";
      select.appendChild(empty);
      hideLoading();
      return;
    }

    areas.forEach(function(area) {
      const count = getTasksForWorkId(area.workId).length;
      const option = document.createElement("option");
      option.value = area.id;
      option.innerText = area.areaName + " - " + getAreaAssignment(area) + " - " + count + " TASKS";
      select.appendChild(option);
    });

    hideLoading();
  }

  function selectReassignmentArea(areaId) {
    selectedReassignmentAreaId = areaId || "";
  }

  async function saveSelectedReassignmentArea() {
    const category = document.getElementById("reassignCategory").value;

    if (category === "Dehumidifier") {
      await saveDehumidifierRoomReassignment();
      return;
    }

    if (!selectedReassignmentAreaId) {
      showAppMessage("Select a room.");
      return;
    }

    await moveReassignmentArea(selectedReassignmentAreaId);
  }

  function limitRoomInput(input) {
    input.value = String(input.value || "").replace(/\D/g, "").slice(0, 3);
  }

  function getRoomKey(value) {
    const text = String(value || "").trim().toLowerCase();
    const digits = text.match(/\d+/g);

    if (digits && digits.length > 0) {
      return digits.join("");
    }

    return text.replace(/[^a-z0-9]+/g, "");
  }

  function findAreaByRoomAndCategory(roomValue, categoryValue) {
    const roomKey = getRoomKey(roomValue);

    return allAreas.find(function(area) {
      return area.category === categoryValue &&
        getRoomKey(area.areaName) === roomKey;
    });
  }

  function getActiveHousekeepingAssignments() {
    return getActiveAssignments().filter(function(assignment) {
      return assignment !== "Laundry";
    });
  }

  function findTargetRoomForDehumidifier(roomValue) {
    const roomKey = getRoomKey(roomValue);
    const activeAssignments = getActiveHousekeepingAssignments();
    const preferredCategories = ["Daily Room", "Weekly Room", "Common Area"];

    for (let i = 0; i < preferredCategories.length; i++) {
      const categoryName = preferredCategories[i];

      const exact = allAreas.find(function(area) {
        return area.category === categoryName &&
          activeAssignments.includes(getAreaAssignment(area)) &&
          getRoomKey(area.areaName) === roomKey &&
          isAreaForCurrentDay(area);
      });

      if (exact) return exact;
    }

    for (let i = 0; i < preferredCategories.length; i++) {
      const categoryName = preferredCategories[i];

      const fallback = allAreas.find(function(area) {
        return area.category === categoryName &&
          activeAssignments.includes(getAreaAssignment(area)) &&
          getRoomKey(area.areaName) === roomKey;
      });

      if (fallback) return fallback;
    }

    return allAreas.find(function(area) {
      return area.category !== "Dehumidifier" &&
        activeAssignments.includes(getAreaAssignment(area)) &&
        getRoomKey(area.areaName) === roomKey;
    });
  }


  function getDehumidifierAssignmentForRoom(roomValue) {
    const targetArea = findTargetRoomForDehumidifier(roomValue);
    if (targetArea) return getAreaAssignment(targetArea);

    const roomKey = getRoomKey(roomValue);
    const firstDigit = String(roomKey || "").charAt(0);

    if (firstDigit === "1") return "1stfloor";
    if (firstDigit === "2") return "2ndFloor";
    if (firstDigit === "3") return "3rdFloor";

    return currentAssignment || "1stfloor";
  }

  async function moveDehumidifierToRoom(fromArea, toRoomValue) {
    const cleanToRoom = String(toRoomValue || "").replace(/\D/g, "").slice(0, 3);

    if (!fromArea || !cleanToRoom) {
      dehumidifierReassignStep = "to";
      showDehumidifierMoveToInput();
      return;
    }

    if (cleanToRoom.length !== 3) {
      dehumidifierReassignStep = "to";
      showAppMessage("Enter 3 digits.");
      return;
    }

    if (getRoomKey(fromArea.areaName) === getRoomKey(cleanToRoom)) {
      dehumidifierReassignStep = "to";
      showAppMessage("Choose a different room.");
      return;
    }

    const targetArea = findTargetRoomForDehumidifier(cleanToRoom);

    if (!targetArea) {
      dehumidifierReassignStep = "to";
      drawAdminAreaButtons("Dehumidifier");
      showAppMessage("No destination room found for " + cleanToRoom + ".");
      return;
    }

    const activeAssignments = getActiveHousekeepingAssignments();

    const visibleDehumidifierRoomKeys = Array.from(document.querySelectorAll("#adminAreaButtons .room-number"))
      .map(function(item) {
        return getRoomKey(item.innerText);
      });

    const destinationIsVisibleDehumidifier = visibleDehumidifierRoomKeys.includes(getRoomKey(cleanToRoom));

    const duplicate = destinationIsVisibleDehumidifier
      ? allAreas.find(function(area) {
          return area.id !== fromArea.id &&
            area.category === "Dehumidifier" &&
            activeAssignments.includes(getAreaAssignment(area)) &&
            getRoomKey(area.areaName) === getRoomKey(cleanToRoom);
        })
      : null;

    if (duplicate) {
      dehumidifierReassignStep = "to";
      drawAdminAreaButtons("Dehumidifier");
      showAppMessage("Room already have a dehumidifier.");
      return;
    }

    const targetAssignment = getAreaAssignment(targetArea);
    const targetScheduleDay = "daily";
    const oldRoomName = fromArea.areaName;
    const newRoomName = targetArea.areaName;

    const ok = await showAppConfirmMessage(
      "Are you sure you want to move room from " + oldRoomName + " to " + newRoomName + "?"
    );

    if (!ok) {
      dehumidifierReassignStep = "";
      dehumidifierFromAreaId = "";
      drawAdminAreaButtons("Dehumidifier");
      return;
    }

    showLoading();

    const oldWorkId = fromArea.workId;
    const newWorkId = buildWorkId(newRoomName, "Dehumidifier", targetScheduleDay, targetAssignment);

    await updateDoc(doc(db, "areas", fromArea.id), {
      areaId: newWorkId,
      workId: newWorkId,
      areaName: newRoomName,
      areaSearch: String(newRoomName || "").toLowerCase(),
      category: "Dehumidifier",
      categoryKey: makeId("Dehumidifier"),
      schedule: targetAssignment,
      modeType: getModeTypeForAssignment(targetAssignment),
      modeLabel: targetAssignment,
      floor: targetArea.floor || getFloorForAssignment(targetAssignment),
      day: targetScheduleDay,
      scheduleDay: targetScheduleDay,
      updatedAt: serverTimestamp()
    });

    const tasksToMove = getTasksForWorkId(oldWorkId);

    for (let i = 0; i < tasksToMove.length; i++) {
      await updateDoc(doc(db, "tasks", tasksToMove[i].id), {
        areaId: newWorkId,
        workId: newWorkId,
        areaName: newRoomName,
        areaSearch: String(newRoomName || "").toLowerCase(),
        category: "Dehumidifier",
        categoryKey: makeId("Dehumidifier"),
        schedule: targetAssignment,
        modeType: getModeTypeForAssignment(targetAssignment),
        modeLabel: targetAssignment,
        floor: targetArea.floor || getFloorForAssignment(targetAssignment),
        day: targetScheduleDay,
        updatedAt: serverTimestamp()
      });
    }

    dehumidifierReassignStep = "";
    dehumidifierFromAreaId = "";

    await loadAdminTasks();
    drawAdminAreaButtons("Dehumidifier");

    hideLoading();
    showAppMessage("Room " + oldRoomName + " has been moved to " + newRoomName + ".");
  }

  async function saveDehumidifierRoomReassignment() {
    const fromRoom = document.getElementById("dehumidifierFromRoomInput").value.trim();
    const toRoom = document.getElementById("dehumidifierToRoomInput").value.trim();

    if (!fromRoom || !toRoom) {
      showAppMessage("Enter from room and to room.");
      return;
    }

    const fromArea = findAreaByRoomAndCategory(fromRoom, "Dehumidifier");

    if (!fromArea) {
      showAppMessage("No dehumidifier found for room " + fromRoom + ".");
      return;
    }

    await moveDehumidifierToRoom(fromArea, toRoom);
  }

  async function moveReassignmentArea(areaId) {
    const area = allAreas.find(function(item) { return item.id === areaId; });
    const toAssignment = document.getElementById("reassignTo").value;
    const fromAssignment = document.getElementById("reassignFrom").value;
    const category = document.getElementById("reassignCategory").value;
    const targetScheduleDay = isWeeklyCategory(category) ? reassignTargetDayName : (area ? area.scheduleDay : "daily");

    if (!area || !fromAssignment || !toAssignment || !category) {
      showAppMessage("Select from, to, and category.");
      return;
    }

    if (isWeeklyCategory(category) && (!reassignWorkDayName || !reassignTargetDayName)) {
      showAppMessage("Select from day and to day.");
      return;
    }

    if (fromAssignment === "Laundry" && toAssignment === "Laundry") {
      openLaundryScheduleEditor(category);
      return;
    }

    if (fromAssignment === toAssignment &&
        String(area.scheduleDay || "").trim().toLowerCase() === String(targetScheduleDay || "").trim().toLowerCase()) {
      showAppMessage("This area is already on that schedule and day.");
      return;
    }

    const duplicate = allAreas.find(function(item) {
      return item.id !== area.id &&
        getAreaAssignment(item) === toAssignment &&
        item.category === area.category &&
        String(item.areaName || "").trim().toLowerCase() === String(area.areaName || "").trim().toLowerCase() &&
        String(item.scheduleDay || "").trim().toLowerCase() === String(targetScheduleDay || "").trim().toLowerCase();
    });

    if (duplicate) {
      showAppMessage("Cannot duplicate assignments. This area already exists in " + toAssignment + " for " + targetScheduleDay + ".");
      return;
    }

    const moveText = isWeeklyCategory(category)
      ? "Move " + area.areaName + " from " + fromAssignment + " - " + reassignWorkDayName + " to " + toAssignment + " - " + targetScheduleDay + "?"
      : "Move " + area.areaName + " to " + toAssignment + "?";

    const ok = confirm(moveText);
    if (!ok) return;

    showLoading();

    const oldWorkId = area.workId;
    const newWorkId = buildWorkId(area.areaName, area.category, targetScheduleDay, toAssignment);

    await updateDoc(doc(db, "areas", area.id), {
      areaId: newWorkId,
      workId: newWorkId,
      schedule: toAssignment,
      modeType: getModeTypeForAssignment(toAssignment),
      modeLabel: toAssignment,
      floor: getFloorForAssignment(toAssignment),
      day: targetScheduleDay,
      scheduleDay: targetScheduleDay,
      updatedAt: serverTimestamp()
    });

    const tasksToMove = getTasksForWorkId(oldWorkId);

    for (let i = 0; i < tasksToMove.length; i++) {
      await updateDoc(doc(db, "tasks", tasksToMove[i].id), {
        areaId: newWorkId,
        workId: newWorkId,
        schedule: toAssignment,
        modeType: getModeTypeForAssignment(toAssignment),
        modeLabel: toAssignment,
        floor: getFloorForAssignment(toAssignment),
        day: targetScheduleDay,
        updatedAt: serverTimestamp()
      });
    }

    await loadAdminTasks();
    hideLoading();
    showAppMessage("Moved.");
    drawReassignmentToPreview();
    await loadReassignmentAreas();
  }

  function openLaundryScheduleEditor(category) {
    const laundryCategory = category === "Daily Laundry" ? "Daily Laundry" : "Weekly Laundry";

    document.getElementById("laundryScheduleCategory").value = laundryCategory;
    document.getElementById("laundryFromDay").value = isWeeklyCategory(laundryCategory) ? reassignWorkDayName : "";
    document.getElementById("laundryToDay").value = "";
    document.getElementById("laundryHandling").value = "";
    document.getElementById("laundryScheduleSearch").value = "";
    document.getElementById("laundryScheduleRoomList").innerHTML = "";
    document.getElementById("laundryScheduleMessage").innerText = "";
    changeLaundryScheduleCategory();
    showAdminView("adminLaundryScheduleView");
  }

  function changeLaundryScheduleCategory() {
    const category = document.getElementById("laundryScheduleCategory").value;
    const showDay = isWeeklyCategory(category);
    document.getElementById("laundryFromDayBox").classList.toggle("hidden", !showDay);
    document.getElementById("laundryToDayBox").classList.toggle("hidden", !showDay);
    document.getElementById("laundryScheduleRoomList").innerHTML = "";
    document.getElementById("laundryScheduleMessage").innerText = "";
    laundryScheduleRooms = [];
  }

  async function loadLaundryScheduleRooms() {
    const category = document.getElementById("laundryScheduleCategory").value;
    const fromDay = document.getElementById("laundryFromDay").value;

    if (isWeeklyCategory(category) && !fromDay) {
      showAppMessage("Select current day.");
      return;
    }

    showLoading();

    laundryScheduleRooms = allAreas.filter(function(area) {
      if (getAreaAssignment(area) !== "Laundry") return false;
      if (area.category !== category) return false;
      if (isWeeklyCategory(category)) {
        return String(area.scheduleDay || "").trim().toLowerCase() === fromDay.toLowerCase();
      }
      return true;
    }).sort(function(a, b) {
      return String(a.areaName || "").localeCompare(String(b.areaName || ""), undefined, { numeric: true });
    });

    drawLaundryScheduleRooms();
    hideLoading();
  }

  function drawLaundryScheduleRooms() {
    const box = document.getElementById("laundryScheduleRoomList");
    const searchText = String(document.getElementById("laundryScheduleSearch").value || "").trim().toLowerCase();

    box.innerHTML = "";

    const rooms = laundryScheduleRooms.filter(function(area) {
      if (!searchText) return true;
      return String(area.areaName || "").toLowerCase().includes(searchText);
    });

    if (rooms.length === 0) {
      const empty = document.createElement("h3");
      empty.innerText = "No rooms found.";
      box.appendChild(empty);
      return;
    }

    rooms.forEach(function(area) {
      const label = document.createElement("label");
      label.className = "laundry-room-item";

      const handling = area.laundryType || "Staff Laundry";
      const dayText = isWeeklyCategory(area.category) ? String(area.scheduleDay || "") + " - " : "";

      label.innerHTML =
        '<input type="checkbox" class="laundryRoomCheck" value="' + escapeHtml(area.id) + '">' +
        '<span>' + escapeHtml(area.areaName || "Room") + '<br><small>' + escapeHtml(dayText + handling) + '</small></span>';

      box.appendChild(label);
    });
  }

  function getCheckedLaundryRoomIds() {
    return Array.from(document.querySelectorAll(".laundryRoomCheck:checked"))
      .map(function(input) { return input.value; });
  }

  function selectAllLaundryRooms() {
    document.querySelectorAll(".laundryRoomCheck").forEach(function(input) {
      input.checked = true;
    });
  }

  function clearLaundryRoomSelection() {
    document.querySelectorAll(".laundryRoomCheck").forEach(function(input) {
      input.checked = false;
    });
  }

  function buildLaundryWorkId(area, newDay, newHandling) {
    return buildAreaId(
      "laundry",
      "Laundry",
      area.category,
      newDay,
      area.areaName,
      "",
      newHandling || area.laundryType || "Staff Laundry"
    );
  }

  async function saveLaundryScheduleChanges() {
    const category = document.getElementById("laundryScheduleCategory").value;
    const toDayValue = document.getElementById("laundryToDay").value;
    const handlingValue = document.getElementById("laundryHandling").value;
    const checkedIds = getCheckedLaundryRoomIds();

    if (checkedIds.length === 0) {
      showAppMessage("Select rooms.");
      return;
    }

    if (isWeeklyCategory(category) && !toDayValue && !handlingValue) {
      showAppMessage("Choose a new day or laundry handling.");
      return;
    }

    if (!isWeeklyCategory(category) && !handlingValue) {
      showAppMessage("Choose laundry handling.");
      return;
    }

    const ok = confirm("Update " + checkedIds.length + " laundry room(s)?");
    if (!ok) return;

    showLoading();

    let updatedCount = 0;

    for (let i = 0; i < checkedIds.length; i++) {
      const area = allAreas.find(function(item) { return item.id === checkedIds[i]; });
      if (!area) continue;

      const oldWorkId = area.workId;
      const newDay = isWeeklyCategory(category) ? (toDayValue || area.scheduleDay || area.day || "") : "daily";
      const newHandling = handlingValue || area.laundryType || "Staff Laundry";
      const newWorkId = buildLaundryWorkId(area, newDay, newHandling);

      await updateDoc(doc(db, "areas", area.id), {
        areaId: newWorkId,
        workId: newWorkId,
        schedule: "Laundry",
        modeType: "laundry",
        modeLabel: "Laundry",
        day: newDay,
        scheduleDay: newDay,
        laundryType: newHandling,
        updatedAt: serverTimestamp()
      });

      const tasksToMove = getTasksForWorkId(oldWorkId);

      for (let t = 0; t < tasksToMove.length; t++) {
        await updateDoc(doc(db, "tasks", tasksToMove[t].id), {
          areaId: newWorkId,
          workId: newWorkId,
          schedule: "Laundry",
          modeType: "laundry",
          modeLabel: "Laundry",
          day: newDay,
          laundryType: newHandling,
          updatedAt: serverTimestamp()
        });
      }

      updatedCount++;
    }

    await loadAdminTasks();
    await loadLaundryScheduleRooms();
    hideLoading();
    document.getElementById("laundryScheduleMessage").innerText = "Updated " + updatedCount + " room(s).";
  }

  async function checkAssignmentCounts() {
    updateReassignmentDateDisplay();
    showLoading();

    const assignments = REAL_ASSIGNMENTS;
    const resultBox = document.getElementById("workloadResults");
    resultBox.innerHTML = "";

    document.getElementById("workloadDayTitle").innerText = "Weekly counts use from day: " + reassignWorkDayName;

    assignments.forEach(function(assignment) {
      function countAreas(categoryName, weeklyMode) {
        return allAreas.filter(function(area) {
          if (getAreaAssignment(area) !== assignment) return false;
          if (area.category !== categoryName) return false;
          if (weeklyMode) {
            return String(area.scheduleDay || "").trim().toLowerCase() === reassignWorkDayName.toLowerCase();
          }
          return true;
        }).length;
      }

      const counts = [
        ["Common Area", countAreas("Common Area", false)],
        ["Weekly Room", countAreas("Weekly Room", true)],
        ["Daily Room", countAreas("Daily Room", false)],
        ["Dehumidifier", countAreas("Dehumidifier", false)],
        ["Weekly Laundry", countAreas("Weekly Laundry", true)],
        ["Daily Laundry", countAreas("Daily Laundry", false)]
      ];

      const total = counts.reduce(function(sum, item) { return sum + item[1]; }, 0);
      const card = document.createElement("div");
      card.className = "workload-card";

      let html = "<h3>" + escapeHtml(assignment) + "</h3>";

      counts.forEach(function(item) {
        html +=
          '<div class="workload-row">' +
          '<span>' + escapeHtml(item[0]) + '</span>' +
          '<span>' + item[1] + '</span>' +
          '</div>';
      });

      html += '<div class="workload-total">TOTAL: ' + total + '</div>';
      card.innerHTML = html;
      resultBox.appendChild(card);
    });

    hideLoading();
    showAdminView("adminWorkloadView");
  }

  function backToReassignment() {
    showAdminView("adminReassignmentView");
  }

  /* =========================
     49 - LOGOUT
  ========================== */

  function logout() {
    sessionStorage.clear();
    window.location.href = "index.html";
  }

  /* =========================
     50 - HTML ESCAPE HELPER
  ========================== */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* =========================
     51 - SCHEDULE HELPER
  ========================== */

  function getScheduleForTask(category) {
    if (isWeeklyCategory(category)) {
      const selectedDay = document.getElementById("adminTaskScheduleInput").value;
      if (!selectedDay) {
        alert("Select schedule day.");
        throw new Error("Missing schedule day");
      }
      return selectedDay;
    }
    return "daily";
  }

  /* =========================
     52 - WINDOW FUNCTIONS - DATE / ASSIGNMENT
  ========================== */

  window.changeAdminWorkDateFromBigPicker = changeAdminWorkDateFromBigPicker;
  window.openReportChooser = openReportChooser;
  window.selectReportType = selectReportType;
  window.openReportDateChoice = openReportDateChoice;
  window.useReportToday = useReportToday;
  window.showReportOtherDate = showReportOtherDate;
  window.continueReportOtherDate = continueReportOtherDate;
  window.closeReportFlowPopup = closeReportFlowPopup;
  window.handleReportRoomAutoInput = handleReportRoomAutoInput;
  window.openOperationalReportHome = openOperationalReportHome;
  window.openDailyReportHome = openDailyReportHome;
  window.handleAdminRoomSearchKey = handleAdminRoomSearchKey;
  window.openAdminRoomReportFromSearch = openAdminRoomReportFromSearch;
  window.handleRoomReportSearchKey = handleRoomReportSearchKey;
  window.openRoomReportFromReportSearch = openRoomReportFromReportSearch;
  window.changeRoomReportDate = changeRoomReportDate;
  window.handleDailyReportSearchKey = handleDailyReportSearchKey;
  window.openDailyReportFromSearch = openDailyReportFromSearch;
  window.changeDailyReportDate = changeDailyReportDate;
  window.openIssuesForRoomCategory = openIssuesForRoomCategory;
  window.setAdminAreaWeekday = setAdminAreaWeekday;
  window.changeAdminAssignment = changeAdminAssignment;
  window.searchAdminAreas = searchAdminAreas;
  window.changeAdminAreaScheduleDay = changeAdminAreaScheduleDay;
  window.closeAppMessage = closeAppMessage;
  window.confirmAppMessage = confirmAppMessage;
  window.cancelAppMessage = cancelAppMessage;
  window.toggleHousekeepingMode = toggleHousekeepingMode;
  window.setHousekeepingMode = setHousekeepingMode;

  /* =========================
     53 - WINDOW FUNCTIONS - ADMIN TASKS
  ========================== */

  window.selectAdminAssignment = selectAdminAssignment;
  window.searchAdminAreaTasks = searchAdminAreaTasks;
  window.openNewAdminArea = openNewAdminArea;
  window.openAdminCategory = openAdminCategory;
  window.openDehumidifierReassignment = openDehumidifierReassignment;
  window.limitRoomInput = limitRoomInput;
  window.openAdminAreaTasks = openAdminAreaTasks;
  window.backToAdminAreaEdit = backToAdminAreaEdit;
  window.openNewAdminSubTask = openNewAdminSubTask;
  window.openAdminSubTaskEditor = openAdminSubTaskEditor;
  window.closeAdminSubTaskEditor = closeAdminSubTaskEditor;
  window.cancelAdminSubTaskEditor = cancelAdminSubTaskEditor;
  window.saveAdminAreaOnly = saveAdminAreaOnly;
  window.saveAdminSubTask = saveAdminSubTask;
  window.saveAdminSubTaskToAllWeeklyRooms = saveAdminSubTaskToAllWeeklyRooms;
  window.deleteAdminSubTask = deleteAdminSubTask;
  window.deleteAdminArea = deleteAdminArea;
  window.backToAdminAreas = backToAdminAreas;
  window.backToAdminCategories = backToAdminCategories;
  window.addCheckedTasksToAllAreas = addCheckedTasksToAllAreas;
  window.deleteCheckedTasksFromAllAreas = deleteCheckedTasksFromAllAreas;
  window.toggleAdminBulkTaskBox = toggleAdminBulkTaskBox;
  window.addCheckedTasksToSingleArea = addCheckedTasksToSingleArea;
  window.deleteCheckedTasksFromSingleArea = deleteCheckedTasksFromSingleArea;

  /* =========================
     53B - WINDOW FUNCTIONS - REASSIGNMENT
  ========================== */

  window.openReassignment = openReassignment;
  window.loadReassignmentAreas = loadReassignmentAreas;
  window.moveReassignmentArea = moveReassignmentArea;
  window.selectReassignmentArea = selectReassignmentArea;
  window.saveSelectedReassignmentArea = saveSelectedReassignmentArea;
  window.changeReassignmentFrom = changeReassignmentFrom;
  window.changeReassignmentTo = changeReassignmentTo;
  window.changeReassignmentCategory = changeReassignmentCategory;
  window.changeReassignmentDate = changeReassignmentDate;
  window.setReassignmentFromWeekday = setReassignmentFromWeekday;
  window.setReassignmentToWeekday = setReassignmentToWeekday;
  window.checkAssignmentCounts = checkAssignmentCounts;
  window.backToReassignment = backToReassignment;
  window.openLaundryScheduleEditor = openLaundryScheduleEditor;
  window.changeLaundryScheduleCategory = changeLaundryScheduleCategory;
  window.loadLaundryScheduleRooms = loadLaundryScheduleRooms;
  window.drawLaundryScheduleRooms = drawLaundryScheduleRooms;
  window.selectAllLaundryRooms = selectAllLaundryRooms;
  window.clearLaundryRoomSelection = clearLaundryRoomSelection;
  window.saveLaundryScheduleChanges = saveLaundryScheduleChanges;

  /* =========================
     54 - WINDOW FUNCTIONS - EMPLOYEES
  ========================== */

  window.openMaintenanceDashboard = openMaintenanceDashboard;
  window.openMaintenanceWorkBoard = openMaintenanceWorkBoard;
  window.openMaintenanceInspection = openMaintenanceInspection;
  window.openMaintenanceInspectionReport = openMaintenanceInspectionReport;
  window.openMaintenanceMaterialsNeeded = openMaintenanceMaterialsNeeded;
  window.openMaintenanceManualMaterialPopup = openMaintenanceManualMaterialPopup;
  window.selectMaintenanceManualMaterialLocation = selectMaintenanceManualMaterialLocation;
  window.confirmMaintenanceManualMaterialPopup = confirmMaintenanceManualMaterialPopup;
  window.cancelMaintenanceManualMaterialPopup = cancelMaintenanceManualMaterialPopup;
  window.markMaintenanceManualMaterialBought = markMaintenanceManualMaterialBought;
  window.drawMaintenanceInspectionReport = drawMaintenanceInspectionReport;
  window.refreshMaintenanceInspectionReport = refreshMaintenanceInspectionReport;
  window.handleMaintenanceInspectionReportInput = handleMaintenanceInspectionReportInput;
  window.reinspectMaintenanceIssue = reinspectMaintenanceIssue;
  window.markMaintenanceInspectionReady = markMaintenanceInspectionReady;
  window.selectMaintenanceResidentStatus = selectMaintenanceResidentStatus;
  window.selectMaintenanceUrgency = selectMaintenanceUrgency;
  window.drawMaintenanceInspectionAreaList = drawMaintenanceInspectionAreaList;
  window.handleMaintenanceInspectionSearchInput = handleMaintenanceInspectionSearchInput;
  window.openMaintenanceInspectionStartPopup = openMaintenanceInspectionStartPopup;
  window.chooseMaintenanceInspectionSearchType = chooseMaintenanceInspectionSearchType;
  window.handleMaintenanceStartInput = handleMaintenanceStartInput;
  window.confirmMaintenanceInspectionStartPopup = confirmMaintenanceInspectionStartPopup;
  window.cancelMaintenanceInspectionStartPopup = cancelMaintenanceInspectionStartPopup;
  window.selectMaintenanceInspectionArea = selectMaintenanceInspectionArea;
  window.changeMaintenanceInspectionItem = changeMaintenanceInspectionItem;
  window.selectMaintenanceInspectionReason = selectMaintenanceInspectionReason;
  window.openMaintenanceNewItemPopup = openMaintenanceNewItemPopup;
  window.openMaintenanceNewReasonPopup = openMaintenanceNewReasonPopup;
  window.openMaintenanceMaterialsPopup = openMaintenanceMaterialsPopup;
  window.selectMaintenanceInspectionMaterial = selectMaintenanceInspectionMaterial;
  window.deleteSelectedMaintenanceInspectionItem = deleteSelectedMaintenanceInspectionItem;
  window.deleteSelectedMaintenanceInspectionReason = deleteSelectedMaintenanceInspectionReason;
  window.deleteSelectedMaintenanceInspectionMaterial = deleteSelectedMaintenanceInspectionMaterial;
  window.confirmMaintenanceTextPopup = confirmMaintenanceTextPopup;
  window.cancelMaintenanceTextPopup = cancelMaintenanceTextPopup;
  window.confirmMaintenanceInspectionResult = confirmMaintenanceInspectionResult;
  window.openMaintenanceInspectionResultPopup = openMaintenanceInspectionResultPopup;
  window.closeMaintenanceInspectionResultPopup = closeMaintenanceInspectionResultPopup;
  window.chooseMaintenanceInspectionResult = chooseMaintenanceInspectionResult;
  window.saveMaintenanceInspectionResult = saveMaintenanceInspectionResult;
  window.openPtacDashboard = openPtacDashboard;
  window.openPtacFloor = openPtacFloor;
  window.openPtacRoom = openPtacRoom;
  window.openPtacRoomFromSearch = openPtacRoomFromSearch;
  window.handlePtacQuickSearch = handlePtacQuickSearch;
  window.savePtacStatus = savePtacStatus;
  window.confirmPtacReset = confirmPtacReset;
  window.openPtacHistory = openPtacHistory;
  window.openPtacNotes = openPtacNotes;
  window.confirmClearPtacNote = confirmClearPtacNote;
  window.openPtacQueue = openPtacQueue;

  window.openEmployees = openEmployees;
  window.openIssues = openIssues;
  window.loadFilteredIssues = loadFilteredIssues;
  window.loadAllIssues = loadAllIssues;
  window.openIssueReasons = openIssueReasons;
  window.openDailyStatus = openDailyStatus;
  window.changeDailyStatusDate = changeDailyStatusDate;
  window.drawDailyStatusList = drawDailyStatusList;
  window.drawIssueList = drawIssueList;
  window.markIssueFollowUp = markIssueFollowUp;
  window.resolveIssue = resolveIssue;
  window.deleteIssueLog = deleteIssueLog;
  window.drawIssueReasonList = drawIssueReasonList;
  window.addIssueReason = addIssueReason;
  window.toggleIssueReason = toggleIssueReason;
  window.deleteIssueReason = deleteIssueReason;
  window.editIssueReasonPrompt = editIssueReasonPrompt;
  window.applyEmployeePermissionDefaultsFromInputs = applyEmployeePermissionDefaultsFromInputs;
  window.openNewEmployee = openNewEmployee;
  window.saveEmployee = saveEmployee;
  window.deleteEmployee = deleteEmployee;

  /* =========================
     55 - WINDOW FUNCTIONS - LOGOUT
  ========================== */
window.setWaterTemperatureFloorFilter = setWaterTemperatureFloorFilter;
  window.openEmployeeAccessDashboard = openEmployeeAccessDashboard;
  window.openWaterTemperatureView = openWaterTemperatureView;
  window.loadWaterTemperatureView = loadWaterTemperatureView;
  window.toggleWaterTemperatureSummary = toggleWaterTemperatureSummary;
  window.confirmDeleteWaterTemperatureRecords = confirmDeleteWaterTemperatureRecords;
  window.openWeeklySchedulesFromEmployeeDashboard = openWeeklySchedulesFromEmployeeDashboard;
  window.openPtacFromEmployeeDashboard = openPtacFromEmployeeDashboard;

  window.openWaterTemperatureComingSoon = openWaterTemperatureView;

  window.openQuickToolsView = openQuickToolsView;
  window.setQuickToolsFloor = setQuickToolsFloor;
  window.handleQuickToolsRoomSearch = handleQuickToolsRoomSearch;
  window.selectQuickToolsAreaFromDropdown = selectQuickToolsAreaFromDropdown;
  window.openQuickToolsMaintenance = openQuickToolsMaintenance;
  window.openQuickToolsRoomReport = openQuickToolsRoomReport;
  window.openQuickToolsDailyReport = openQuickToolsDailyReport;
  window.openQuickToolsPtac = openQuickToolsPtac;
  window.openRoomSafeCheck = openRoomSafeCheck;
  window.drawRoomSafeCheck = drawRoomSafeCheck;
  window.changeRoomSafeDayFilter = changeRoomSafeDayFilter;
  window.changeRoomSafeDateFilter = changeRoomSafeDateFilter;
  window.changeRoomSafeTypeFilter = changeRoomSafeTypeFilter;
  window.clearRoomSafeFilters = clearRoomSafeFilters;
  window.openRoomSafeAddRoom = openRoomSafeAddRoom;
  window.cancelRoomSafeAddRoom = cancelRoomSafeAddRoom;
  window.saveRoomSafeAddedRoom = saveRoomSafeAddedRoom;

  window.backToScheduleEditorList = backToScheduleEditorList;
  window.exitScheduleEditorToAdmin = exitScheduleEditorToAdmin;

  window.logout = logout;
