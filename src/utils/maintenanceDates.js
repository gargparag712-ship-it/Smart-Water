export function localDateString(date = new Date()) {
  const local = new Date(date.getTime());
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 10);
}

export function maintenanceDateStatus(record, today = localDateString()) {
  if (!['Scheduled', 'In Progress'].includes(record.status)) return '';
  if (record.scheduledDate < today) return 'overdue';
  if (record.scheduledDate === today) return 'dueToday';
  const gap = Date.parse(`${record.scheduledDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`);
  return gap <= 7 * 86400000 ? 'upcoming' : '';
}

export function summarizeMaintenance(records, today = localDateString()) {
  return {
    total: records.length,
    scheduled: records.filter((record) => record.status === 'Scheduled').length,
    inProgress: records.filter((record) => record.status === 'In Progress').length,
    completed: records.filter((record) => record.status === 'Completed').length,
    overdue: records.filter((record) => maintenanceDateStatus(record, today) === 'overdue').length,
    dueToday: records.filter((record) => maintenanceDateStatus(record, today) === 'dueToday').length,
    upcoming: records.filter((record) => maintenanceDateStatus(record, today) === 'upcoming').length,
    pending: records.filter((record) => ['Scheduled', 'In Progress'].includes(record.status)).length,
    attention: records.filter((record) => ['overdue', 'dueToday'].includes(maintenanceDateStatus(record, today))).length,
  };
}

export function filterMaintenance(records, filters = {}) {
  const query = filters.search?.trim().toLocaleLowerCase() ?? '';
  return records.filter((record) => (!query || [record.workOrderCode, record.assetCode, record.assetName, record.title, record.assignedTo].some((value) => value?.toLocaleLowerCase().includes(query)))
    && (!filters.maintenanceType || record.maintenanceType === filters.maintenanceType)
    && (!filters.status || record.status === filters.status)
    && (!filters.priority || record.priority === filters.priority)
    && (!filters.fromDate || record.scheduledDate >= filters.fromDate)
    && (!filters.toDate || record.scheduledDate <= filters.toDate));
}

export function buildMaintenanceAlerts(records, today = localDateString()) {
  return records.filter((record) => maintenanceDateStatus(record, today)).map((record) => {
    const status = maintenanceDateStatus(record, today);
    const dayGap = Math.round((Date.parse(`${record.scheduledDate}T00:00:00.000Z`) - Date.parse(`${today}T00:00:00.000Z`)) / 86400000);
    const timing = status === 'overdue' ? `${Math.abs(dayGap)} day${Math.abs(dayGap) === 1 ? '' : 's'} overdue` : status === 'dueToday' ? 'Due today' : `Due in ${dayGap} day${dayGap === 1 ? '' : 's'}`;
    return { level: status === 'overdue' ? 'overdue' : 'warning', title: `${status === 'overdue' ? 'Overdue' : status === 'dueToday' ? 'Due today' : 'Upcoming'}: ${record.title}`, detail: `${record.workOrderCode} · ${record.assetName} (${record.assetCode})`, time: timing };
  });
}
