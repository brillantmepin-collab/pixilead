import { describe, it, expect } from "vitest";
import { mapPlaceToLead } from "@/lib/apify/mapper";

describe("Apify Place Mapper", () => {
  it("correctly maps raw Apify place item to Supabase lead schema", () => {
    const rawItem = {
      placeId: "ChIJ123456",
      title: "Hôtel Sawa Douala",
      categoryName: "Hôtel",
      address: "Bonanjo, Douala",
      city: "Douala",
      phone: "+237 6 99 00 11 22",
      website: "https://hotelsawa.cm",
      totalScore: 4.6,
      reviewsCount: 320,
      url: "https://maps.google.com/place",
      location: { lat: 4.04, lng: 9.69 },
    };

    const searchId = "search_123";
    const userId = "user_456";

    const mapped = mapPlaceToLead(rawItem, searchId, userId);

    expect(mapped.search_id).toBe(searchId);
    expect(mapped.user_id).toBe(userId);
    expect(mapped.place_id).toBe("ChIJ123456");
    expect(mapped.name).toBe("Hôtel Sawa Douala");
    expect(mapped.phone).toBe("+237699001122");
    expect(mapped.rating).toBe(4.6);
    expect(mapped.reviews_count).toBe(320);
  });
});
