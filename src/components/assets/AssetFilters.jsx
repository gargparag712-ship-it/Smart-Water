import { Search, SlidersHorizontal, X } from 'lucide-react';
import { assetCategories, assetConditions, assetStatuses } from '../../data/assetOptions.js';

export default function AssetFilters({ filters, onChange, onClear, hasFilters, resultCount, totalCount }) {
  return <section className="asset-filter-panel" aria-label="Search and filter assets">
    <div className="asset-search"><Search size={17} aria-hidden="true" /><input value={filters.search} onChange={(event) => onChange('search', event.target.value)} type="search" placeholder="Search name, code, serial or location..." aria-label="Search assets" /></div>
    <span className="filter-divider" />
    <div className="filter-controls"><span className="filter-label"><SlidersHorizontal size={14} /> Filters</span>
      <select value={filters.category} onChange={(event) => onChange('category', event.target.value)} aria-label="Filter by category"><option value="">All categories</option>{assetCategories.map((category) => <option key={category}>{category}</option>)}</select>
      <select value={filters.condition} onChange={(event) => onChange('condition', event.target.value)} aria-label="Filter by condition"><option value="">All conditions</option>{assetConditions.map((condition) => <option key={condition}>{condition}</option>)}</select>
      <select value={filters.status} onChange={(event) => onChange('status', event.target.value)} aria-label="Filter by operational status"><option value="">All statuses</option>{assetStatuses.map((status) => <option key={status}>{status}</option>)}</select>
      {hasFilters && <button className="clear-filters" onClick={onClear} type="button"><X size={13} /> Clear</button>}
    </div>
    <div className="filter-result-count">Showing <strong>{resultCount}</strong> of {totalCount} assets</div>
  </section>;
}
