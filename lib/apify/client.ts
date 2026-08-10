import { ApifyClient } from "apify-client";

export const apify = new ApifyClient({
  token: process.env.APIFY_TOKEN || "apify_api_placeholder_key",
});

export const GOOGLE_MAPS_ACTOR = "compass/crawler-google-places";
