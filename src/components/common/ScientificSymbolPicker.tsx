import React, { useState } from 'react';
import { Pi, X } from 'lucide-react';

interface ScientificSymbolPickerProps {
  onInsert: (symbol: string) => void;
}

const SYMBOL_CATEGORIES = [
  {
    name: 'Algebra & Arithmetic',
    symbols: ['²', '³', '⁴', 'ⁿ', '½', '¼', '¾', '±', '×', '÷', '√', '∛', '≈', '≠', '≤', '≥', '∝', '∞', '%', '‰']
  },
  {
    name: 'Greek Letters (Physics & Math)',
    symbols: ['α', 'β', 'γ', 'δ', 'Δ', 'ε', 'θ', 'λ', 'μ', 'π', 'ρ', 'σ', 'Σ', 'τ', 'φ', 'ω', 'Ω']
  },
  {
    name: 'Calculus & Sets',
    symbols: ['∫', '∬', '∂', '∇', 'lim', 'dx', 'dt', '∈', '∉', '⊂', '⊆', '∪', '∩', '∅', '∀', '∃']
  },
  {
    name: 'Science & Units',
    symbols: ['°', '℃', '℉', '→', '⇌', '↑', '↓', 'Å', 'Ω', 'μm', 'kg/m³', 'm/s²', 'N·m', 'J/mol', 'mol/dm³']
  }
];

export const ScientificSymbolPicker: React.FC<ScientificSymbolPickerProps> = ({ onInsert }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors border border-slate-200/80 bg-white"
        title="Insert scientific symbol or equation mark"
      >
        <Pi className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-72 sm:w-80 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 text-left animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800">Scientific Symbol Keyboard</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 mb-2 no-scrollbar">
            {SYMBOL_CATEGORIES.map((cat, idx) => (
              <button
                key={cat.name}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-2 py-1 text-[11px] font-medium rounded-lg whitespace-nowrap transition-colors ${
                  activeTab === idx
                    ? 'bg-purple-700 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Symbols Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-48 overflow-y-auto p-1">
            {SYMBOL_CATEGORIES[activeTab].symbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => {
                  onInsert(sym);
                }}
                className="h-8 flex items-center justify-center font-mono text-sm bg-slate-50 hover:bg-purple-100 hover:text-purple-900 rounded-lg border border-slate-100 transition-colors active:scale-95"
              >
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
