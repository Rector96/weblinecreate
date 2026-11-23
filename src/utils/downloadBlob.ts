/**
 * Trigger a browser download for a generated Blob.
 *
 * Use a same-document Blob URL rather than relying on FileSaver's platform
 * detection. The URL is kept alive briefly so browsers have time to begin the
 * download before it is released.
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('The download file is empty. Please try again.');
  }

  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    throw new Error('This browser does not support downloading generated files.');
  }

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    // Do not revoke synchronously: Safari and some mobile browsers need time
    // to resolve the Blob URL after the synthetic click.
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}
