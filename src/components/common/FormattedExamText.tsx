import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    MathJax?: {
      startup?: { promise?: Promise<unknown> };
      typesetPromise?: (elements?: HTMLElement[]) => Promise<unknown>;
      typesetClear?: (elements?: HTMLElement[]) => void;
      tex?: Record<string, unknown>;
      options?: Record<string, unknown>;
    };
    __rockcraftMathJaxPromise?: Promise<void>;
  }
}

function ensureMathJax(): Promise<void> {
  if (window.MathJax?.typesetPromise) return Promise.resolve();
  if (window.__rockcraftMathJaxPromise) return window.__rockcraftMathJaxPromise;

  window.MathJax = {
    tex: { inlineMath: [['\\(', '\\)']], displayMath: [['\\[', '\\]']] },
    options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] },
    startup: { typeset: false } as any,
  };

  window.__rockcraftMathJaxPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Math formatting could not be loaded.'));
    document.head.appendChild(script);
  });

  return window.__rockcraftMathJaxPromise;
}

/**
 * Normalize common raw AI output before typesetting:
 * - remove literal Markdown bold markers from exam questions;
 * - wrap equations/formulas in parentheses even when the model omitted TeX delimiters;
 * - keep already-delimited MathJax expressions unchanged.
 */
function normalizeExamMath(input: string): string {
  let value = String(input || '').replace(/\*\*(.*?)\*\*/gs, '$1');

  // Convert raw parenthetical formulas such as (v = \frac{d}{t}) to inline TeX.
  value = value.replace(/(?<!\\)\(([^()\n]*?(?:\\[A-Za-z]+|[_^]|(?:=|≤|≥|≠|≈))[^()\n]*)(?<!\\)\)/g, (_match, formula: string) => {
    const trimmed = formula.trim();
    if (trimmed.startsWith('\\(') || trimmed.startsWith('\\[')) return _match;
    return '\\(' + trimmed + '\\)';
  });

  return value;
}

/** Renders AI LaTeX using MathJax while keeping generated content as safe React text. */
export const FormattedExamText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const containerRef = useRef<HTMLSpanElement>(null);
  const formattedText = normalizeExamMath(text);

  useEffect(() => {
    let cancelled = false;
    const renderMath = async () => {
      const element = containerRef.current;
      if (!element || (!formattedText.includes(String.fromCharCode(92) + '(') && !formattedText.includes(String.fromCharCode(92) + '['))) return;
      try {
        await ensureMathJax();
        await window.MathJax?.startup?.promise;
        if (cancelled || !containerRef.current || !window.MathJax?.typesetPromise) return;
        window.MathJax.typesetClear?.([containerRef.current]);
        await window.MathJax.typesetPromise([containerRef.current]);
      } catch {
        // Keep the original readable text if the math engine is unavailable.
      }
    };
    void renderMath();
    return () => {
      cancelled = true;
      if (containerRef.current) window.MathJax?.typesetClear?.([containerRef.current]);
    };
  }, [formattedText]);

  return <span ref={containerRef} className={className}>{formattedText}</span>;
};
