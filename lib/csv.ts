import { getWhatsAppLink } from "./phone";

export interface LeadForCsv {
  name: string;
  category?: string | null;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  maps_url?: string | null;
  generated_message?: string | null;
}

function escapeCsvField(val: string | number | null | undefined, isPhone = false): string {
  if (val === null || val === undefined) return '""';

  let str = String(val).trim();
  if (isPhone && str) {
    // Prefix phone number with apostrophe or ensure format preserves leading + and zeros in Excel
    if (!str.startsWith("'")) {
      str = `'${str}`;
    }
  }

  // Escape existing double quotes by doubling them
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

export function generateLeadsCsv(leads: LeadForCsv[]): string {
  const headers = [
    "Nom",
    "Catégorie",
    "Téléphone",
    "WhatsApp Direct",
    "Site Web",
    "Email",
    "Adresse",
    "Ville",
    "Note Google",
    "Nombre d'Avis",
    "Lien Google Maps",
    "Message IA Généré",
  ];

  const headerRow = headers.map((h) => escapeCsvField(h)).join(";");

  const rows = leads.map((lead) => {
    const waLink = getWhatsAppLink(lead.phone, lead.generated_message || undefined) || "";
    return [
      escapeCsvField(lead.name),
      escapeCsvField(lead.category),
      escapeCsvField(lead.phone, true),
      escapeCsvField(waLink),
      escapeCsvField(lead.website),
      escapeCsvField(lead.email),
      escapeCsvField(lead.address),
      escapeCsvField(lead.city),
      escapeCsvField(lead.rating),
      escapeCsvField(lead.reviews_count),
      escapeCsvField(lead.maps_url),
      escapeCsvField(lead.generated_message),
    ].join(";");
  });

  // UTF-8 BOM prefix for perfect French Excel formatting
  return "\uFEFF" + [headerRow, ...rows].join("\n");
}
