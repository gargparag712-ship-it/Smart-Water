function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function formatMoney(value, unit = 'paise') {
  const rupees = unit === 'rupees' ? value : value / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(rupees);
}
function formatValue(value, format) {
  if (format === 'money') return formatMoney(value);
  if (format === 'rupees') return formatMoney(value, 'rupees');
  if (typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value)) return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN');
  return value === '' || value === null || value === undefined ? '—' : value;
}
function chartMarkup(chart) {
  const points = chart.points ?? [];
  if (!points.length) return `<section class="report-chart"><h2>${escapeHtml(chart.title)}</h2><p class="empty">No records for this chart.</p></section>`;
  const series = Object.keys(points[0]).filter((key) => key !== 'label');
  const max = Math.max(1, ...points.flatMap((point) => series.map((key) => Math.abs(Number(point[key]) || 0))));
  return `<section class="report-chart"><h2>${escapeHtml(chart.title)}</h2><div class="chart-rows">${points.map((point) => `<div class="chart-row"><span>${escapeHtml(point.label)}</span><div>${series.map((key) => { const value = Math.max(0, Number(point[key]) || 0); const width = Math.max(0, Math.min(100, value / max * 100)); const amount = key.toLowerCase().includes('income') || key.toLowerCase().includes('expense') ? formatMoney(value) : value; return `<div class="chart-series"><i style="width:${width.toFixed(1)}%"></i><small>${escapeHtml(key)} · ${escapeHtml(amount)}</small></div>`; }).join('')}</div></div>`).join('')}</div></section>`;
}
function buildPdfHtml(report) {
  const generated = new Date(report.generatedAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' });
  const period = report.dateRange?.from || report.dateRange?.to ? `${report.dateRange.from || 'Any date'} to ${report.dateRange.to || 'Any date'}` : 'All available dates';
  const metrics = (report.metrics ?? []).map((metric) => `<article><span>${escapeHtml(metric.label)}</span><strong>${escapeHtml(formatValue(metric.value, metric.format))}</strong></article>`).join('');
  const sections = (report.sections ?? []).map((section) => {
    const columns = section.columns ?? [];
    const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('');
    const body = section.rows?.length ? section.rows.map((row) => `<tr>${columns.map((column) => `<td>${escapeHtml(formatValue(row[column.key], column.format))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${Math.max(columns.length, 1)}" class="empty">No records for this report.</td></tr>`;
    return `<section class="report-section"><h2>${escapeHtml(section.title)}</h2><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title><style>
    *{box-sizing:border-box}body{font:11px Arial,sans-serif;color:#253d36;margin:30px}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #168b76;padding-bottom:14px}.brand{font-weight:700;font-size:18px;color:#116c5b}.brand span{color:#48a284}header small{display:block;margin-top:4px;color:#82928b;font-size:9px}h1{font-size:22px;margin:19px 0 5px}.meta{color:#778780;font-size:9px;line-height:1.7}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:17px 0}.metrics article{padding:10px;border:1px solid #dfe9e4;border-radius:6px}.metrics span{display:block;color:#788980;font-size:9px}.metrics strong{display:block;margin-top:5px;font-size:14px;color:#246451}.report-section,.report-chart{margin:18px 0;break-inside:avoid}.report-section h2,.report-chart h2{margin:0 0 8px;font-size:13px;color:#285a4b}table{width:100%;border-collapse:collapse;font-size:8px}th{background:#edf5f1;color:#45665a;text-align:left;font-weight:700}th,td{border:1px solid #dde7e2;padding:6px;vertical-align:top;overflow-wrap:anywhere}tr{break-inside:avoid}.empty{padding:14px;color:#85938d;text-align:center}.chart-row{display:grid;grid-template-columns:110px 1fr;gap:9px;margin:7px 0}.chart-row>span{font-size:8px;color:#647a70}.chart-series{position:relative;min-height:13px;margin-bottom:3px}.chart-series i{display:block;min-width:1px;height:7px;border-radius:4px;background:#238b79}.chart-series:nth-child(2) i{background:#e1a843}.chart-series small{display:block;margin-top:2px;color:#6e8077;font-size:7px}footer{margin-top:24px;border-top:1px solid #e2ebe6;padding-top:8px;color:#8a9791;font-size:8px}@page{size:A4 landscape;margin:12mm}
  </style></head><body><header><div class="brand">Smart<span>Water</span><small>Water supply operations · reports</small></div><div style="text-align:right;color:#73847c;font-size:9px">Generated ${escapeHtml(generated)}<br>Period: ${escapeHtml(period)}</div></header><h1>${escapeHtml(report.title)}</h1><div class="meta">Report data is based on records saved locally in SmartWater. Financial amounts are shown in Indian Rupees (INR).</div><div class="metrics">${metrics || '<article><span>Records</span><strong>0</strong></article>'}</div>${(report.charts ?? []).map(chartMarkup).join('')}${sections}<footer>SmartWater · Locally generated report · ${escapeHtml(generated)}</footer></body></html>`;
}

module.exports = { buildPdfHtml, escapeHtml, formatMoney, formatValue };
