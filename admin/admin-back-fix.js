/* =========================
   99 - ADMIN BACK BUTTON PATCH
========================== */

(function () {
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
      var el = document.getElementById(id);
      if (el) el.classList.add("hidden");
    });
  }

  window.backToScheduleEditorList = function () {
    hideAdminViews();
    var scheduleEditorView = document.getElementById("adminScheduleEditorView");
    if (scheduleEditorView) scheduleEditorView.classList.remove("hidden");
  };

  window.exitScheduleEditorToAdmin = function () {
    hideAdminViews();
    var adminView = document.getElementById("adminView2");
    if (adminView) adminView.classList.remove("hidden");
  };
})();
