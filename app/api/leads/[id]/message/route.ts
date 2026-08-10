import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getAuthenticatedUser,
  unauthorizedResponse,
  insufficientCreditsResponse,
} from "@/lib/auth";
import {
  ensureProfile,
  consumeCredits,
  refundCredits,
} from "@/lib/credits-server";
import { AI_MESSAGE_CREDIT_COST } from "@/lib/credits";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LeadLike = {
  name?: string | null;
  category?: string | null;
  city?: string | null;
  rating?: number | null;
  reviews_count?: number | null;
  website?: string | null;
  phone?: string | null;
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: leadId } = await params;
    const body = await request.json().catch(() => ({}));

    const channel = body.channel || "whatsapp";
    const tone = body.tone || "amical";
    const messageType = body.messageType || "premier_contact";

    // Les fiches de démonstration (landing, recherche sans résultats) portent
    // un id non-UUID. On sert le générateur de secours : ni crédit débité, ni
    // appel LLM, ni écriture en base.
    if (!UUID_RE.test(leadId)) {
      const demoLead: LeadLike = {
        name: typeof body.leadName === "string" ? body.leadName : "Entreprise",
        city: typeof body.leadCity === "string" ? body.leadCity : null,
        website: body.hasWebsite ? "https://exemple.cm" : null,
      };
      return NextResponse.json({
        leadId,
        leadName: demoLead.name,
        phone: null,
        demo: true,
        message: buildFallbackMessage(demoLead, channel, toneLabelOf(tone), messageType),
      });
    }

    // Fiche réelle : identité obligatoire, la génération est facturée.
    const user = await getAuthenticatedUser(request);
    if (!user) return unauthorizedResponse();

    const supabase = createAdminClient();
    await ensureProfile(supabase, user);

    const { data: lead } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Fiche introuvable." }, { status: 404 });
    }
    // Un utilisateur ne génère de messages que sur ses propres fiches.
    if (lead.user_id && lead.user_id !== user.id) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }

    const debit = await consumeCredits(
      supabase,
      user.id,
      AI_MESSAGE_CREDIT_COST,
      "ai_message",
      "lead",
      leadId
    );
    if (!debit.ok) {
      return insufficientCreditsResponse(AI_MESSAGE_CREDIT_COST, debit.balance);
    }

    try {
      const message = await generateMessage(lead, channel, tone, messageType);

      // `user_id` est NOT NULL en base : l'omettre faisait échouer l'insertion
      // en silence, et les messages n'atterrissaient jamais dans l'export CSV.
      const { error: insertError } = await supabase.from("messages").insert({
        lead_id: leadId,
        user_id: user.id,
        channel,
        angle: message.angle,
        content: message.text,
        model: message.model,
      });
      if (insertError) {
        console.error("[MESSAGES] Insertion impossible:", insertError.message);
      }

      console.log(
        `[💳 CRÉDITS] -${AI_MESSAGE_CREDIT_COST} crédit (message IA) | Solde: ${debit.balance}`
      );

      return NextResponse.json({
        leadId,
        leadName: lead.name,
        phone: lead.phone || null,
        balance: debit.balance,
        creditsSpent: AI_MESSAGE_CREDIT_COST,
        message: { angle: message.angle, subject: message.subject, text: message.text },
      });
    } catch (genErr) {
      // Génération réellement impossible : on rend le crédit.
      await refundCredits(
        supabase,
        user.id,
        AI_MESSAGE_CREDIT_COST,
        "refund_search",
        "lead",
        leadId
      );
      throw genErr;
    }
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erreur serveur lors de la génération IA";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function toneLabelOf(tone: string): string {
  return tone === "professionnel"
    ? "Professionnel & Direct"
    : tone === "persuasif"
      ? "Persuasif & Preuve Sociale"
      : "Amical & Bienveillant";
}

async function generateMessage(
  lead: LeadLike,
  channel: string,
  tone: string,
  messageType: string
): Promise<{ angle: string; subject?: string; text: string; model?: string }> {
  const leadName = lead?.name || "Entreprise";
  const category = lead?.category || "Commerce";
  const city = lead?.city || "votre ville";
  const rating = lead?.rating ? `${lead.rating}/5` : "Non noté";
  const reviewsCount = lead?.reviews_count ? `${lead.reviews_count} avis` : "0 avis";
  const hasWebsite = Boolean(lead?.website);

  const channelLabel =
    channel === "email" ? "Email" : channel === "sms" ? "SMS" : "WhatsApp";
  const toneLabel = toneLabelOf(tone);
  const typeLabel =
    messageType === "relance"
      ? "Relance courtoise"
      : messageType === "offre_speciale"
        ? "Offre spéciale & Audit gratuit"
        : "Premier contact direct";

  const signalText = !hasWebsite
    ? "Signal fort : Ce prospect n'a PAS de site web référencé sur sa fiche Google Maps."
    : `Signal fort : Ce prospect a une note Google Maps de ${rating} (${reviewsCount}).`;

  const leadContext = `PROSPECT :
Nom : ${leadName}
Activité : ${category}
Ville : ${city}
Note Google : ${rating} (${reviewsCount})
Site Web : ${lead?.website || "Aucun"}
${signalText}

INSTRUCTIONS DE RÉDACTION :
Canal de destination : ${channelLabel}
Ton souhaité : ${toneLabel}
Type de message : ${typeLabel}
Expéditeur : PixiLead (Solutions d'acquisition B2B & visibilité locale à ${city}).`;

  const apiKey = process.env.OPENAI_API_KEY;

  if (apiKey && !apiKey.includes("placeholder")) {
    try {
      const openai = new OpenAI({ apiKey });
      const systemInstruction = `Tu es un expert en rédaction commerciale B2B en Afrique francophone.
Rédige UN SEUL message de prospection ultra-personnalisé et percutant.
Consignes strictes par canal :
- Si canal = WhatsApp : utilise des émojis pertinents, structure le texte avec des sauts de ligne doubles (\\n\\n) et garde une taille idéale pour la lecture sur smartphone. Pas d'objet.
- Si canal = Email : inclus un champ "subject" accrocheur et un texte "text" aéré avec formule de politesse.
- Si canal = SMS : rédige un message très court (< 160 caractères), direct et percutant avec appel à l'action.

Format JSON strict de réponse :
{"angle": "${toneLabel}", "subject": "Objet si email sinon omit", "text": "Contenu du message"}`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: leadContext },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.text) {
          return {
            angle: parsed.angle || toneLabel,
            subject: parsed.subject || undefined,
            text: parsed.text,
            model: "gpt-4o-mini",
          };
        }
      }
    } catch (apiErr) {
      console.warn("OpenAI API Error, fallback generator active:", apiErr);
    }
  }

  return buildFallbackMessage(lead, channel, toneLabel, messageType);
}

/** Générateur de secours (clé OpenAI absente ou API en échec). */
function buildFallbackMessage(
  lead: LeadLike,
  channel: string,
  toneLabel: string,
  _messageType: string
): { angle: string; subject?: string; text: string; model?: string } {
  const leadName = lead?.name || "Entreprise";
  const city = lead?.city || "votre ville";
  const hasWebsite = Boolean(lead?.website);
  const rating = lead?.rating ? `${lead.rating}/5` : "excellente";

  const websiteSignal = !hasWebsite
    ? `En consultant votre fiche Google Maps à ${city}, j'ai remarqué que vous n'avez pas encore de site web référencé.`
    : `Félicitations pour votre excellente note de ${rating} sur Google Maps à ${city} !`;

  if (channel === "email") {
    return {
      angle: toneLabel,
      subject: `Proposition de collaboration — ${leadName} x PixiLead`,
      text: `Bonjour l'équipe de ${leadName},\n\n${websiteSignal}\n\nNous accompagnons les entreprises à ${city} pour accélérer leur prospection commerciale et générer des demandes de devis qualifiées.\n\nSeriez-vous disponible pour un court échange de 5 minutes cette semaine ?\n\nBien cordialement,\nL'équipe PixiLead`,
      model: "fallback",
    };
  }

  if (channel === "sms") {
    return {
      angle: toneLabel,
      text: `Bonjour ${leadName}, boostez vos clients à ${city} grâce à PixiLead. ${
        !hasWebsite ? "Créez votre site web rapidement." : "Attirez plus de leads."
      } Contactez-nous sur WhatsApp !`,
      model: "fallback",
    };
  }

  return {
    angle: toneLabel,
    text: `Bonjour l'équipe de ${leadName} 👋\n\n${websiteSignal}\n\nJe me permets de vous contacter car nous accompagnons les établissements à ${city} pour optimiser leur visibilité digitale et attirer de nouveaux clients B2B qualifiés.\n\nSeriez-vous disponible pour un court échange de 2 minutes sur WhatsApp cette semaine ?`,
    model: "fallback",
  };
}
