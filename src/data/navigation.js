import {
  BarChart3, Boxes, ChartNoAxesCombined, CircleDollarSign, Gauge,
  Package, Settings2, Truck, Wrench,
} from 'lucide-react';

export const pageDetails = [
  { label: 'Dashboard', path: '/', icon: Gauge, description: 'Your scheme operations at a glance.' },
  { label: 'Assets', title: 'Asset Management', path: '/assets', icon: Boxes, description: 'Track pumps, motors, pipelines, valves and other scheme assets.' },
  { label: 'Inventory', title: 'Inventory Management', path: '/inventory', icon: Package, description: 'Manage consumables, spare parts and stock levels across your schemes.' },
  { label: 'Maintenance', title: 'Maintenance Management', path: '/maintenance', icon: Wrench, description: 'Plan inspections, coordinate repairs and preserve maintenance history for registered assets.' },
  { label: 'Finance', title: 'Finance Management', path: '/finance', icon: CircleDollarSign, description: 'Track scheme income, operating expenses and monthly category budgets.' },
  { label: 'Suppliers', path: '/suppliers', icon: Truck, description: 'Keep supplier details and procurement contacts together.' },
  { label: 'Reports', path: '/reports', icon: ChartNoAxesCombined, description: 'Explore operational summaries and scheme reports.' },
  { label: 'Settings', path: '/settings', icon: Settings2, description: 'Manage preferences for your SmartWater workspace.' },
];

export const primaryNavigation = pageDetails.slice(0, 7);
export const secondaryNavigation = pageDetails.slice(7);

export const placeholderIcon = {
  Assets: Boxes, Inventory: Package, Maintenance: Wrench, Finance: CircleDollarSign,
  Suppliers: Truck, Reports: BarChart3, Settings: Settings2,
};
