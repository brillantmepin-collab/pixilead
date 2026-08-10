"use client";

import { useState } from "react";
import Link from "next/link";
import { X, Sparkles, Copy, Check, MessageSquare, ExternalLink, Mail, MessageCircle, RefreshCw, Send, Sliders, Coins } from "lucide-react";
import { getWhatsAppLink } from "@/lib/phone";
import { authFetch, readApiError } from "@/lib/supabase/auth-fetch";
import { AI_MESSAGE_CREDIT_COST, CREDITS_EVENT } from "@/lib/credits";

export interface MessageVariant {
  angle: string;
  subject?: string;
  text: string;
}

interface MessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
  leadPhone?: string | null;
  leadEmail?: string | null;
  hasWebsite?: boolean;
}

export function MessageModal({
  isOpen,
  onClose,
  leadId,
  leadName,
  leadPhone,
  leadEmail,
  hasWebsite = false,
}: MessageModalProps) {
  // 3 Menus Déroulants States
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms">("whatsapp");
  const [messageType, setMessageType] = useState<"premier_contact" | "relance" | "offre_speciale" | "invitation">("premier_contact");
  const [tone, setTone] = useState<"amical" | "professionnel" | "persuasif">("amical");

  // Generation states
  const [loading, setLoading] = useState<boolean>(false);
  const [generatedMessage, setGeneratedMessage] = useState<MessageVariant | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [blockedReason, setBlockedReason] = useState<"login" | "credits" | null>(null);

  if (!isOpen) return null;

  // Single Message Generation Triggered ONLY by User Click
  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setBlockedReason(null);
    setGeneratedMessage(null);

    try {
      const res = await authFetch(`/api/leads/${leadId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          messageType,
          tone,
          // Utilisés uniquement pour les fiches de démonstration (id non-UUID),
          // qui ne consomment aucun crédit.
          leadName,
          hasWebsite,
        }),
      });

      if (!res.ok) {
        const err = await readApiError(res);
        setErrorMsg(err.message);
        if (err.needsLogin) setBlockedReason("login");
        if (err.needsCredits) setBlockedReason("credits");
        return;
      }

      const data = await res.json();
      if (data.message) {
        setGeneratedMessage(data.message);
        if (typeof data.balance === "number") {
          window.dispatchEvent(
            new CustomEvent(CREDITS_EVENT, { detail: { balance: data.balance } })
          );
        }
      } else {
        setErrorMsg("Aucun message n'a été retourné par l'IA.");
      }
    } catch {
      setErrorMsg("Impossible de joindre le service IA.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Action links generator for direct outreach launch
  const getActionLink = () => {
    if (!generatedMessage) return null;

    if (channel === "whatsapp") {
      const waUrl = getWhatsAppLink(leadPhone, generatedMessage.text);
      return waUrl ? { url: waUrl, label: "Envoyer sur WhatsApp", icon: MessageSquare, bg: "bg-emerald-600 hover:bg-emerald-700 text-white" } : null;
    }

    if (channel === "email") {
      const subject = encodeURIComponent(generatedMessage.subject || `Prospection ${leadName}`);
      const body = encodeURIComponent(generatedMessage.text);
      const emailTarget = leadEmail || "";
      const mailtoUrl = `mailto:${emailTarget}?subject=${subject}&body=${body}`;
      return { url: mailtoUrl, label: "Ouvrir votre client Mail", icon: Mail, bg: "bg-blue-600 hover:bg-blue-700 text-white" };
    }

    if (channel === "sms") {
      const smsBody = encodeURIComponent(generatedMessage.text);
      const phoneTarget = leadPhone || "";
      const smsUrl = `sms:${phoneTarget}?body=${smsBody}`;
      return { url: smsUrl, label: "Envoyer par SMS", icon: MessageCircle, bg: "bg-amber-600 hover:bg-amber-700 text-white" };
    }

    return null;
  };

  const actionLink = getActionLink();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container: Taille réduite max-w-lg, Cadre bordures vertes, fond blanc et écriture noire */}
      <div className="bg-white border-2 border-emerald-600 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-900">
        
        {/* Modal Header */}
        <div className="p-3.5 sm:p-4 border-b border-emerald-100 flex items-center justify-between bg-emerald-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                Générateur de Message IA — {leadName}
              </h3>
              <p className="text-[11px] text-slate-600 font-medium">
                Sélectionnez vos critères puis cliquez sur le bouton rouge pour générer 1 seul message
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-emerald-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          
          {/* Formulaire de Configuration : 3 Menus Déroulants */}
          <div className="bg-slate-50 border border-emerald-200 rounded-xl p-3.5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Précisions de prospection</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Menu Déroulant 1 : Canal de contact */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-[11px] block">
                  1. Canal de contact :
                </label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all shadow-sm"
                >
                  <option value="whatsapp">📱 WhatsApp (Direct E.164)</option>
                  <option value="email">✉️ Email (Professionnel)</option>
                  <option value="sms">💬 SMS (Message direct)</option>
                </select>
              </div>

              {/* Menu Déroulant 2 : Type de message */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 text-[11px] block">
                  2. Type de message :
                </label>
                <select
                  value={messageType}
                  onChange={(e) => setMessageType(e.target.value as any)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all shadow-sm"
                >
                  <option value="premier_contact">🎯 Premier contact direct</option>
                  <option value="relance">🔄 Relance courtoise</option>
                  <option value="offre_speciale">🎁 Offre spéciale & Audit gratuit</option>
                  <option value="invitation">🤝 Invitation à un échange</option>
                </select>
              </div>
            </div>

            {/* Menu Déroulant 3 : Ton du message */}
            <div className="space-y-1 text-xs">
              <label className="font-bold text-slate-700 text-[11px] block">
                3. Ton du message :
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as any)}
                className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition-all shadow-sm"
              >
                <option value="amical">🤝 Ton Amical & Bienveillant</option>
                <option value="professionnel">👔 Ton Professionnel & Direct</option>
                <option value="persuasif">🚀 Ton Persuasif & Preuve Sociale</option>
              </select>
            </div>

            {/* Red Action Button with White Text */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-5 py-2.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Génération en cours...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-white" />
                    <span>GÉNÉRER LE MESSAGE</span>
                    <span className="text-[10px] font-extrabold bg-black/25 px-2 py-0.5 rounded-full">
                      −{AI_MESSAGE_CREDIT_COST} crédit
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>{errorMsg}</span>
              {blockedReason === "credits" && (
                <Link
                  href="/app/credits"
                  className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Coins className="w-3.5 h-3.5" />
                  Recharger
                </Link>
              )}
              {blockedReason === "login" && (
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 shrink-0 text-[11px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  Se connecter
                </Link>
              )}
            </div>
          )}

          {/* Single Generated Message Box: Fond Blanc, Écritures Noires, Bordure Verte */}
          {generatedMessage && (
            <div className="bg-white border-2 border-emerald-600 rounded-xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
                <span className="text-[11px] font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Message Généré ({channel.toUpperCase()})</span>
                </span>
                <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                  {generatedMessage.text.length} caractères
                </span>
              </div>

              {generatedMessage.subject && (
                <div className="text-xs font-bold text-slate-900 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-200">
                  <span className="text-slate-600 mr-1">Objet :</span> {generatedMessage.subject}
                </div>
              )}

              {/* Message Content Bubble (White background, Dark text) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 whitespace-pre-wrap leading-relaxed font-sans shadow-inner selection:bg-emerald-200">
                {generatedMessage.text}
              </div>

              {/* Actions Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                <button
                  onClick={() => handleCopy(generatedMessage.text)}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold px-3.5 py-1.5 rounded-lg border border-slate-300 transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copié !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-600" />
                      <span>Copier le message</span>
                    </>
                  )}
                </button>

                {actionLink && (
                  <a
                    href={actionLink.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`w-full sm:w-auto text-xs font-extrabold px-4 py-2 rounded-lg shadow transition-all flex items-center justify-center gap-2 ${actionLink.bg}`}
                  >
                    <actionLink.icon className="w-3.5 h-3.5" />
                    <span>{actionLink.label}</span>
                    <ExternalLink className="w-3 h-3 opacity-80" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium text-[11px] hidden sm:inline">
            1 crédit utilisé par message généré
          </span>
          <button
            onClick={onClose}
            className="ml-auto bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-1.5 rounded-lg text-xs transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}



