/* =========================
   99 - ADMIN BACK BUTTON SAFETY PATCH
========================== */

(function () {
  const VERSION_LABEL = "Updated: 2026-05-22 6:45 PM | admin.html";

  function updateVersionLabels() {
    document.querySelectorAll(".app-version-label").forEach(function (el) {
      el.innerText = VERSION_LABEL;
    });
  }

  function hideAdminViews() {
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
    ].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
  }

  function showOnly(viewId) {
    hideAdminViews();
    updateVersionLabels();
    const view = document.getElementById(viewId);
    if (view) view.classList.remove("hidden");
  }

  window.backToScheduleEditorList = function () {
    showOnly("adminScheduleEditorView");
  };

  window.exitScheduleEditorToAdmin = function () {
    showOnly("adminView2");
  };

  document.addEventListener("click", function (event) {
    const button = event.target && event.target.closest ? event.target.closest("button.back") : null;
    if (!button) return;
    if (String(button.innerText || "").trim().toUpperCase() !== "BACK") return;

    const scheduleList = document.getElementById("adminScheduleEditorView");
    const scheduleChoice = document.getElementById("adminScheduleChoiceView");

    if (scheduleChoice && !scheduleChoice.classList.contains("hidden")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showOnly("adminScheduleEditorView");
      return;
    }

    if (scheduleList && !scheduleList.classList.contains("hidden")) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showOnly("adminView2");
    }
  }, true);

  document.addEventListener("DOMContentLoaded", updateVersionLabels);
  setInterval(updateVersionLabels, 1000);
})();
