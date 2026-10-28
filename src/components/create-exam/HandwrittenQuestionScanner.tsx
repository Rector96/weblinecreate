import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Upload, X, Loader2, ScanText, AlertTriangle } from 'lucide-react';

type ExtractedQuestion = {
  section: 'A' | 'B';
  question_number: number;
  question_text: string;
  option_a?: string; option_b?: string; option_c?: string; option_d?: string;
  correct_option?: 'A' | 'B' | 'C' | 'D';
  marks?: number;
  model_answer?: string;
  score_breakdown?: string;
  confidence?: 'high' | 'medium' | 'low';
  review_notes?: string[];
  diagram_image?: string;
};

type Props = {
  schoolId: string;
  getAuthHeaders: () => Promise<Headers>;
  onQuestionsExtracted: (questions: ExtractedQuestion[]) => void;
  onClose: () => void;
};

export const HandwrittenQuestionScanner: React.FC<Props> = ({ schoolId, getAuthHeaders, onQuestionsExtracted, onClose }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusLine, setStatusLine] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);

  const clearPhotos = () => {
    setFiles([]);
    setPreviews([]);
    if (inputRef.current) inputRef.current.value = '';
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const valid = incoming.filter(file => /^image\/(jpeg|png|webp)$/i.test(file.type) && file.size <= 8 * 1024 * 1024);
    if (valid.length !== incoming.length) setError('Use JPG, PNG or WebP images up to 8 MB each.');
    setFiles(current => [...current, ...valid].slice(0, 8));
    if (files.length + valid.length > 8) setError('You can scan up to 8 pages at a time.');
  };

  const scan = async () => {
    if (!files.length) { setError('Take a photo or upload at least one page.'); return; }
    setBusy(true); setError(''); setStatusLine('Preparing clear photos…');
    try {
      const pages = await Promise.all(files.map(async (file) => {
        let imageSource: CanvasImageSource;
        let sourceWidth = 0;
        let sourceHeight = 0;
        let bitmap: ImageBitmap | null = null;
        try {
          if (typeof createImageBitmap !== 'function') throw new Error('ImageBitmap unavailable');
          bitmap = await createImageBitmap(file);
          imageSource = bitmap;
          sourceWidth = bitmap.width;
          sourceHeight = bitmap.height;
        } catch {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read the selected photo.'));
            reader.onerror = () => reject(new Error('Could not read the selected photo.'));
            reader.readAsDataURL(file);
          });
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('This photo format cannot be opened by your browser. Please choose a JPG or PNG photo, or take a new photo using the camera button.'));
            img.src = dataUrl;
          });
          imageSource = image;
          sourceWidth = image.naturalWidth;
          sourceHeight = image.naturalHeight;
        }
        if (!sourceWidth || !sourceHeight) {
          bitmap?.close();
          throw new Error('The selected photo is empty or unreadable. Please choose a clear JPG or PNG photo.');
        }
        const maxSide = 1400;
        const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) { bitmap?.close(); throw new Error('Image compression is unavailable in this browser.'); }
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
        bitmap?.close();
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Could not prepare an image for scanning.')), 'image/jpeg', 0.68));
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const value = String(reader.result || '').split(',')[1];
            value ? resolve(value) : reject(new Error('Could not read one of the compressed images.'));
          };
          reader.onerror = () => reject(new Error('Could not read one of the compressed images.'));
          reader.readAsDataURL(blob);
        });
        return { mimeType: 'image/jpeg', data };
      }));
      const totalEncodedSize = pages.reduce((sum, page) => sum + page.data.length, 0);
      if (totalEncodedSize > 5_000_000) throw new Error('These pages are still too large to send safely. Try scanning 3–4 pages at a time.');
      setStatusLine('Sending pages securely…');
      const headers = await getAuthHeaders();
      headers.set('Content-Type', 'application/json');
      const response = await fetch('/api/scan-handwritten-questions', {
        method: 'POST', headers, body: JSON.stringify({ school_id: schoolId, pages }),
      });
      const parseResponse = async (res: Response) => {
        const raw = await res.text();
        try { return JSON.parse(raw); }
        catch { throw new Error(res.status === 429
          ? 'Lots of schools may be scanning right now. Your scan can be retried shortly.'
          : 'The scanner service is temporarily busy. Your photos are still here—please try again in a moment.'); }
      };
      let result: any = await parseResponse(response);
      if (!response.ok || !result.success) throw new Error(typeof result.error === 'string' ? result.error : 'We could not add your scan to the queue.');
      if (!result.queued || !result.request_id) throw new Error('The scan was not queued. Your photos are still here—please retry.');
      const requestId = result.request_id as string;
      const deadline = Date.now() + 6 * 60 * 1000;
      let pollCount = 0;
      setStatusLine('In the school queue…');
      while (Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, pollCount < 5 ? 1200 : 2200));
        pollCount += 1;
        if (pollCount === 3) setStatusLine('Reading handwriting with AI…');
        else if (pollCount === 8) setStatusLine('Matching diagrams to questions…');
        else if (pollCount === 15) setStatusLine('Still working — please keep this screen open…');
        const pollHeaders = await getAuthHeaders();
        pollHeaders.set('x-school-id', schoolId);
        const pollResponse = await fetch('/api/scan-handwritten-questions?id=' + encodeURIComponent(requestId), { method: 'GET', headers: pollHeaders });
        result = await parseResponse(pollResponse);
        if (!pollResponse.ok || !result.success) throw new Error(result.error || 'Could not check scan progress.');
        if (result.status === 'failed') throw new Error(result.error || 'The scan could not be completed. Please retry; your original photos are still available.');
        if (result.status === 'completed') break;
      }
      if (result.status !== 'completed') throw new Error('Your scan is still in the queue because many schools may be using AI. Your photos are safe on this screen—press Analyse again in a moment.');
      setStatusLine('Attaching diagrams…');
      const extracted = Array.isArray(result.data) ? result.data : [];
      const diagramRegions = Array.isArray(result.diagram_regions) ? result.diagram_regions : [];
      const cropDiagram = async (region: any): Promise<string | null> => {
        const file = files[region.page_index];
        if (!file) return null;
        try {
          const url = URL.createObjectURL(file);
          const image = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
            img.src = url;
          });
          const padX = Math.min(0.03, Math.max(0, region.x) * 0.25);
          const padY = Math.min(0.03, Math.max(0, region.y) * 0.25);
          const nx = Math.max(0, region.x - padX);
          const ny = Math.max(0, region.y - padY);
          const nw = Math.min(1 - nx, region.width + padX * 2);
          const nh = Math.min(1 - ny, region.height + padY * 2);
          const left = Math.max(0, Math.floor(nx * image.naturalWidth));
          const top = Math.max(0, Math.floor(ny * image.naturalHeight));
          const width = Math.min(image.naturalWidth - left, Math.ceil(nw * image.naturalWidth));
          const height = Math.min(image.naturalHeight - top, Math.ceil(nh * image.naturalHeight));
          if (width < 2 || height < 2) return null;
          const scale = Math.min(1, 1000 / Math.max(width, height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(image, left, top, width, height, 0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/jpeg', 0.82);
        } catch { return null; }
      };
      const crops = await Promise.all(diagramRegions.map(async (region: any) => ({ region, image: await cropDiagram(region) })));
      const withDiagrams = extracted.map((question: ExtractedQuestion) => {
        const match = crops.find(({ region, image }) =>
          image
          && region.section === question.section
          && Number(region.question_number) === Number(question.question_number)
        ) || crops.find(({ region, image }) =>
          image
          && Number(region.question_number) === Number(question.question_number)
        );
        return match?.image ? { ...question, diagram_image: match.image } : question;
      });
      if (!withDiagrams.length) throw new Error('No questions could be confidently extracted. Try brighter, sharper photos with the whole page visible.');
      onQuestionsExtracted(withDiagrams);
      clearPhotos();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scanning failed. Please try again.');
    } finally {
      setBusy(false);
      setStatusLine('');
    }
  };

  return <section className="space-y-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5" aria-label="Handwritten question scanner">
    <div className="flex items-start justify-between gap-3">
      <div className="flex gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><ScanText className="h-5 w-5" /></div>
        <div><h3 className="font-bold text-slate-900">Scan handwritten questions</h3><p className="mt-1 text-xs leading-5 text-slate-500">Upload up to 8 page photos. Gemini reads each page in order and flags uncertain handwriting for review.</p></div>
      </div>
      <button type="button" onClick={() => { clearPhotos(); onClose(); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close scanner"><X className="h-4 w-4" /></button>
    </div>
    <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple className="hidden" onChange={e => { addFiles(e.target.files); e.currentTarget.value = ''; }} />
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" onClick={() => { if (inputRef.current) { inputRef.current.removeAttribute('capture'); inputRef.current.click(); } }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Upload className="h-4 w-4" /> Upload page photos</button>
      <button type="button" onClick={() => { if (inputRef.current) { inputRef.current.setAttribute('capture', 'environment'); inputRef.current.click(); } }} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"><Camera className="h-4 w-4" /> Take a photo</button>
    </div>
    {files.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{files.map((file, index) => <div key={file.name + file.lastModified + index} className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"><img src={previews[index] || ''} alt={'Page ' + (index + 1)} className="h-28 w-full object-cover" /><span className="block truncate px-2 py-1 text-[11px] text-slate-600">Page {index + 1}</span><button type="button" onClick={() => setFiles(v => v.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-white/95 p-1 text-slate-700 shadow" aria-label={'Remove page ' + (index + 1)}><X className="h-3.5 w-3.5" /></button></div>)}</div>}
    <p className="text-[11px] text-slate-500">Tips: use bright, even light; keep the page flat and fully inside the frame. Upload pages in reading order. Up to 8 images, 8 MB each. Photos are sent for scanning only and are not saved to your ROCKCRAFT account.</p>
    {error && <p role="alert" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</p>}
    {busy && typeof document !== 'undefined' && createPortal(
      <div role="status" aria-live="polite" className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/90 p-5 text-white">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20"><Loader2 className="h-8 w-8 animate-spin text-blue-300" /></div>
          <h2 className="mt-5 text-xl font-black">ROCKCRAFT is reading your pages</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">{statusLine || 'Handwriting can take a little time. We are checking the pages now.'}</p>
          <p className="mt-4 text-xs text-slate-400">Please keep this screen open. Your photos stay on this device until the scan finishes.</p>
        </div>
      </div>, document.body
    )}
    <button type="button" disabled={busy || !files.length} onClick={scan} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing all pages…</> : <><ScanText className="h-4 w-4" /> Analyse handwriting with Gemini</>}</button>

  </section>;
};
