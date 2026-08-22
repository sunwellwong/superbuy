"use client";

import { useWaNumber } from "@/lib/attrib";
import { WA_DEFAULT_TEXT } from "@/lib/wa";

// Standalone WhatsApp entry point — mirrors the vaplynk site's logic.
// The destination number is resolved on the client (rep attribution when
// present, otherwise the central number) and the link opens a pre-filled
// WhatsApp chat in a new tab. No count badge, no label, just the logo bubble.

export default function FloatingWhatsApp() {
  const wa = useWaNumber();
  const waUrl = `https://wa.me/${wa}?text=${encodeURIComponent(WA_DEFAULT_TEXT)}`;

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp Inquiry"
      className="fixed z-50 inline-flex right-4 bottom-4 sm:right-6 sm:bottom-6"
    >
      <span className="wa-float-breath relative inline-flex items-center justify-center text-white shadow-[0_12px_32px_-8px_rgba(37,211,102,0.65),0_2px_8px_rgba(0,0,0,0.22)] hover:shadow-[0_14px_36px_-8px_rgba(37,211,102,0.8),0_2px_10px_rgba(0,0,0,0.25)] transition-all rounded-full overflow-hidden min-h-[44px] min-w-[44px] bg-[#25D366] hover:bg-[#1ebe57] active:bg-[#19a84b] sm:min-h-[64px] sm:min-w-[64px]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white" aria-hidden="true">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.2 14.2c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.1.1.3 0 .5-.3.6-.6.8-.4 1.1.7 1.2 1.6 2 2.8 2.6.3.2.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 .9c.3.2.5.2.6.4 0 .1 0 .7-.3 1.4z" />
        </svg>
      </span>
    </a>
  );
}
