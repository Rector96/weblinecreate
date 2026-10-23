import React from 'react';
import { MessageCircle } from 'lucide-react';

export const WhatsAppButton: React.FC = () => {
  const phoneNumber = '2348031234567';
  const defaultMessage = encodeURIComponent(
    'Hello ROCKCRAF Support Team, I am reaching out regarding exam paper generation and school subscription on ROCKCRAF.'
  );

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${defaultMessage}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-3.5 py-2.5 rounded-full shadow-lg shadow-emerald-950/15 active:scale-95 transition-all text-xs font-semibold group"
      title="Contact Nigerian Support on WhatsApp"
    >
      <MessageCircle className="w-5 h-5 fill-white stroke-[#25D366]" />
      <span className="hidden sm:inline">WhatsApp Helpdesk</span>
    </a>
  );
};
