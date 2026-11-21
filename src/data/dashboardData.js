export const summaryCards = [
  { label: 'Total assets', value: '—', detail: 'Local asset records', change: 'Reading local records', tone: 'teal', icon: 'assets', source: 'live' },
  { label: 'Active assets', value: '—', detail: 'Local asset records', change: 'Reading local records', tone: 'green', icon: 'active', source: 'live' },
  { label: 'Inventory items', value: '—', detail: 'Local inventory records', change: 'Reading local records', tone: 'blue', icon: 'inventory', source: 'live' },
  { label: 'Low stock alerts', value: '—', detail: 'At or below minimum stock', change: 'Reading local records', tone: 'amber', icon: 'stock', source: 'live' },
  { label: 'Pending maintenance', value: '—', detail: 'Local maintenance work orders', change: 'Reading local records', tone: 'violet', icon: 'maintenance', source: 'live' },
  { label: 'Monthly expenses', value: '₹2.84L', detail: 'Illustrative · November', change: '6% below October', tone: 'rose', icon: 'expenses', source: 'demo' },
];

export const monthlyExpenses = [
  { month: 'Jan', expense: 2.1 }, { month: 'Feb', expense: 2.35 },
  { month: 'Mar', expense: 2.2 }, { month: 'Apr', expense: 2.65 },
  { month: 'May', expense: 2.48 }, { month: 'Jun', expense: 2.92 },
  { month: 'Jul', expense: 3.15 }, { month: 'Aug', expense: 2.86 },
  { month: 'Sep', expense: 3.28 }, { month: 'Oct', expense: 3.02 },
  { month: 'Nov', expense: 2.84 }, { month: 'Dec', expense: 3.1 },
];

export const recentActivities = [
  { type: 'asset', title: 'Pump added to scheme inventory', subtitle: 'Borewell Pump · Kalyanpur', time: 'Today, 10:42 AM', color: 'teal' },
  { type: 'stock', title: 'Inventory stock updated', subtitle: 'Chlorine tablets · +24 packs', time: 'Today, 9:18 AM', color: 'blue' },
  { type: 'maintenance', title: 'Quarterly inspection completed', subtitle: 'Overhead tank · Rampur East', time: 'Yesterday, 4:30 PM', color: 'amber' },
  { type: 'finance', title: 'Repair expense recorded', subtitle: 'Motor bearing replacement', time: 'Yesterday, 1:05 PM', color: 'violet' },
];

