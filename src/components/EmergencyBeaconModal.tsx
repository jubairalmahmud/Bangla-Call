import React, { useState } from 'react';
import { AlertTriangle, X, Radio, MapPin, Send, ShieldAlert } from 'lucide-react';
import { EmergencyAlert, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface EmergencyBeaconModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAlert: (alert: EmergencyAlert) => void;
  lang: LanguageMode;
  selfNodeName: string;
}

export const EmergencyBeaconModal: React.FC<EmergencyBeaconModalProps> = ({
  isOpen,
  onClose,
  onSendAlert,
  lang,
  selfNodeName,
}) => {
  const t = translations[lang];
  const [reason, setReason] = useState('মেডিকেল সহায়তা / মেডিকেল জরুরী প্রয়োজন (Medical Emergency)');
  const [locationName, setLocationName] = useState('মিরপুর ১০, ঢাকা (GPS: 23.8069, 90.3687)');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const alert: EmergencyAlert = {
      id: `sos-${Date.now()}`,
      senderId: 'node-alpha-self',
      senderName: selfNodeName,
      locationName,
      coordinates: { lat: 23.8069, lng: 90.3687 },
      message: reason,
      timestamp: Date.now(),
      hopTrace: ['node-alpha-self', 'ALL_RELAY_FLOOD'],
      acknowledgedBy: [],
    };
    onSendAlert(alert);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="bg-[#14161B] border-2 border-rose-600 w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-rose-950/80 p-3.5 border-b border-rose-600 flex items-center justify-between text-rose-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-rose-600/30 border border-rose-500 flex items-center justify-center text-rose-400 animate-pulse">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-rose-100">{t.emergencyTitle}</h3>
              <p className="text-[11px] text-rose-300/80 uppercase">HIGH PRIORITY MULTI-HOP FLOODING</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-rose-300 hover:text-white bg-rose-900/50 hover:bg-rose-900 border border-rose-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-[#E1E4EA] bg-[#0A0B0E] p-3 border border-[#2D3139] leading-relaxed">
            {t.emergencyDesc}
          </p>

          <div>
            <label className="block text-[#8A909D] mb-1 font-bold uppercase">{t.sosReason}</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-[#0A0B0E] text-white px-3.5 py-2.5 border border-[#2D3139] focus:outline-none focus:border-rose-500"
              required
            />
          </div>

          <div>
            <label className="block text-[#8A909D] mb-1 font-bold uppercase">{t.sosLocation}</label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-rose-400 absolute left-3 top-3" />
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                className="w-full bg-[#0A0B0E] text-white pl-9 pr-3.5 py-2.5 border border-[#2D3139] focus:outline-none focus:border-rose-500"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(225,29,72,0.4)] flex items-center justify-center gap-2 transition-all border border-rose-500"
            >
              <AlertTriangle className="w-4 h-4 animate-bounce" />
              <span>{t.sendSosBtn}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
