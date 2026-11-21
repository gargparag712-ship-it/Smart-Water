export function filterInventory(items, { search = '', category = '', stockStatus = '' } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return items.filter((item) => {
    const matchesSearch = !query || [item.name, item.itemCode, item.location].some((value) => value?.toLocaleLowerCase().includes(query));
    const matchesCategory = !category || item.category === category;
    const out = item.currentStock === 0;
    const low = !out && item.currentStock <= item.minimumStock;
    const matchesStock = !stockStatus || (stockStatus === 'out' ? out : stockStatus === 'low' ? low : !out && !low);
    return matchesSearch && matchesCategory && matchesStock;
  });
}

export function isLowStock(item) { return item.currentStock <= item.minimumStock; }
export function getInventoryCounts(items) {
  return { total: items.length, low: items.filter(isLowStock).length, out: items.filter((item) => item.currentStock === 0).length };
}
