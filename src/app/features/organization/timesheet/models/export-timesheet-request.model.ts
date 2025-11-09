export interface ExportTimesheetRequest {
  departmentId: number;
  period: Date;
  exportWorkHours: boolean;
}
