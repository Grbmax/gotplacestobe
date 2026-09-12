import type { Role } from "./types";
import type { Property } from "./types";

export const LANDLORD_CREATED_BY = "id_landlord_portfolio";

export function isLandlordPortfolio(property: Property) {
  return Boolean(property.landlordPortfolio) || property.createdBy === LANDLORD_CREATED_BY;
}

/** Shared demo file is visible to every role. The East End owner portfolio is owner-only. */
export function propertyVisibleToRole(property: Property, role: Role) {
  if (isLandlordPortfolio(property)) return role === "owner";
  return true;
}

export function propertiesForRole(properties: Property[], role: Role) {
  return properties.filter((p) => propertyVisibleToRole(p, role));
}
