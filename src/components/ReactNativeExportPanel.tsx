import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, Smartphone, ShieldCheck, Download, Layers } from 'lucide-react';
import { reactNativeFiles } from '../lib/reactNativeBlueprint';
import { LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface ReactNativeExportPanelProps {
  lang: LanguageMode;
}

export const ReactNativeExportPanel: React.FC<ReactNativeExportPanelProps> = ({ lang }) => {
  const t = translations[lang];
  const [activeFileId, setActiveFileId] = useState(reactNativeFiles[0].id);
  const [copied, setCopied] = useState(false);

  const activeFile = reactNativeFiles.find((f) => f.id === activeFileId) || reactNativeFiles[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#14161B] border border-[#2D3139] p-5 shadow-2xl flex flex-col gap-5 font-mono">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/40 flex items-center justify-center">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{t.rnExportTitle}</h2>
            <p className="text-xs text-[#8A909D]">{t.rnExportSubtitle}</p>
          </div>
        </div>

        <button
          onClick={handleCopyCode}
          className="px-4 py-2 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black font-extrabold uppercase text-xs transition-all border border-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.2)] flex items-center gap-2"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? t.copied : t.copyCode}</span>
        </button>
      </div>

      {/* File Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[#2D3139]">
        {reactNativeFiles.map((file) => (
          <button
            key={file.id}
            onClick={() => setActiveFileId(file.id)}
            className={`px-3 py-1.5 text-xs font-mono font-bold uppercase whitespace-nowrap transition-all border ${
              activeFileId === file.id
                ? 'bg-[#00FF9C] text-black border-[#00FF9C]'
                : 'bg-[#0E1014] text-[#8A909D] border-[#2D3139] hover:text-white'
            }`}
          >
            {file.filename}
          </button>
        ))}
      </div>

      {/* Code Viewer & Explanation */}
      <div className="space-y-4">
        <div className="bg-[#0A0B0E] p-3.5 border border-[#2D3139] flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-[#00FF9C] shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-white uppercase">{activeFile.title}</h4>
            <p className="text-xs text-[#8A909D] mt-0.5">{activeFile.description}</p>
          </div>
        </div>

        {/* Code Editor Frame */}
        <div className="relative overflow-hidden border border-[#2D3139] bg-[#0A0B0E]">
          <div className="bg-[#14161B] px-4 py-2 border-b border-[#2D3139] flex items-center justify-between text-xs text-[#8A909D] font-mono">
            <span>{activeFile.filename}</span>
            <span className="text-[#00FF9C] font-bold uppercase">{activeFile.language.toUpperCase()}</span>
          </div>

          <pre className="p-4 text-xs font-mono text-[#00FF9C] overflow-x-auto max-h-[420px] leading-relaxed">
            {activeFile.code}
          </pre>
        </div>
      </div>

      {/* Setup Guide Box */}
      <div className="bg-[#0A0B0E] p-4 border border-[#2D3139] text-xs space-y-2 uppercase">
        <div className="flex items-center gap-2 text-[#00FF9C] font-bold">
          <Terminal className="w-4 h-4" />
          <span>REACT NATIVE (ANDROID & IOS) EXPO INSTALLATION:</span>
        </div>
        <pre className="p-3 bg-[#14161B] border border-[#2D3139] text-[#E1E4EA] font-mono text-[11px] overflow-x-auto lowercase">
          npx expo install react-native-ble-plx @noble/ciphers react-native-get-random-values
        </pre>
      </div>
    </div>
  );
};
