function getMaintenanceDateStatus(record, today) {
  if (!['Scheduled', 'In Progress'].includes(record.status)) return null;
  if (record.scheduledDate < today) return 'overdue';
  if (record.scheduledDate === today) return 'dueToday';
  const todayValue = Date.parse(`${today}T00:00:00.000Z`);
  const dueValue = Date.parse(`${record.scheduledDate}T00:00:00.000Z`);
  return dueValue - todayValue <= 7 * 24 * 60 * 60 * 1000 ? 'upcoming' : null;
}

function summarizeMaintenance(records, today) {
  const active = records.filter((record) => ['Scheduled', 'In Progress'].includes(record.status));
  const dateStatuses = records.map((record) => getMaintenanceDateStatus(record, today));
  return {
    total: records.length,
    scheduled: records.filter((record) => record.status === 'Scheduled').length,
    inProgress: records.filter((record) => record.status === 'In Progress').length,
    completed: records.filter((record) => record.status === 'Completed').length,
    overdue: dateStatuses.filter((status) => status === 'overdue').length,
    dueToday: dateStatuses.filter((status) => status === 'dueToday').length,
    upcoming: dateStatuses.filter((status) => status === 'upcoming').length,
    pending: active.length,
    attention: dateStatuses.filter((status) => status === 'overdue' || status === 'dueToday').length,
  };
}

module.exports = { getMaintenanceDateStatus, summarizeMaintenance };
