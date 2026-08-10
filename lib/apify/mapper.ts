import { normalizePhone } from "../phone";

export interface ApifyPlaceItem {
  placeId?: string;
  url?: string;
  title?: string;
  name?: string;
  categoryName?: string;
  category?: string;
  address?: string;
  city?: string;
  phone?: string | null;
  website?: string | null;
  emails?: string[];
  email?: string | null;
  totalScore?: number;
  rating?: number;
  reviewsCount?: number;
  location?: {
    lat?: number;
    lng?: number;
  };
  [key: string]: unknown;
}

export function mapPlaceToLead(item: ApifyPlaceItem, searchId: string, userId: string) {
  const placeId = item.placeId || item.url || `lead_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const name = item.title || item.name || "Entreprise";
  const category = item.categoryName || item.category || null;
  const address = item.address || null;
  const city = item.city || null;
  const phone = normalizePhone(item.phone);
  const website = item.website || null;
  const email = item.emails?.[0] || item.email || null;
  const rating = typeof item.totalScore === "number" ? item.totalScore : (typeof item.rating === "number" ? item.rating : null);
  const reviewsCount = typeof item.reviewsCount === "number" ? item.reviewsCount : null;
  const mapsUrl = item.url || null;
  const lat = item.location?.lat ?? null;
  const lng = item.location?.lng ?? null;

  return {
    search_id: searchId,
    user_id: userId,
    place_id: placeId,
    name,
    category,
    address,
    city,
    phone,
    website,
    email,
    rating,
    reviews_count: reviewsCount,
    maps_url: mapsUrl,
    lat,
    lng,
    raw: item,
  };
}
