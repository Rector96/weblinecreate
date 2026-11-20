/**
 * Save a generated file in the current browser without relying on a delayed
 * FileSaver popup. Object URLs are kept alive long enough for mobile browsers
 * to finish starting the download.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The file was generated empty. Please try again.');
  }

  const anchor = document.createElement('a');
  if (!('download' in anchor)) {
    throw new Error('This browser cannot download files directly. Open ROCKCRAFT in the latest Chrome or Edge and try again.');
  }

  const objectUrl = URL.createObjectURL(blob);
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);

  try {
    anchor.click();
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Your browser blocked the download. Please allow downloads for ROCKCRAFT and try again.');
  } finally {
    anchor.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
