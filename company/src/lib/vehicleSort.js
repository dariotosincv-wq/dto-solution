export const VEHICLE_CATEGORIES = ["LARGE", "MEDIUM", "SMALL", "EXTRA_SMALL"];

const categoryOrder = new Map(
  VEHICLE_CATEGORIES.map((category, index) => [category, index]),
);

const naturalCode = new Intl.Collator("it", {
  numeric: true,
  sensitivity: "base",
});

export function compareCompanyVehicles(left, right) {
  const categoryDifference =
    (categoryOrder.get(left.silhouette_category) ?? Number.MAX_SAFE_INTEGER) -
    (categoryOrder.get(right.silhouette_category) ?? Number.MAX_SAFE_INTEGER);
  return categoryDifference || naturalCode.compare(left.internal_code, right.internal_code);
}

export function sortCompanyVehicles(items) {
  return [...items].sort(compareCompanyVehicles);
}

export function groupCompanyVehicles(items) {
  const sorted = sortCompanyVehicles(items);
  return VEHICLE_CATEGORIES.map((category) => ({
    category,
    items: sorted.filter((vehicle) => vehicle.silhouette_category === category),
  }));
}
