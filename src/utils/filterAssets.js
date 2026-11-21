export function filterAssets(assets, filters) {
  const query = filters.search.trim().toLocaleLowerCase();
  return assets.filter((asset) => {
    const matchesSearch = !query || [asset.name, asset.assetCode, asset.serialNumber, asset.location]
      .some((value) => value.toLocaleLowerCase().includes(query));
    return matchesSearch
      && (!filters.category || asset.category === filters.category)
      && (!filters.condition || asset.condition === filters.condition)
      && (!filters.status || asset.status === filters.status);
  });
}

export function filtersAreActive(filters) {
  return Boolean(filters.search || filters.category || filters.condition || filters.status);
}
