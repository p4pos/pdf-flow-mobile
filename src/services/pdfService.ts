import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  // Use CDN worker matching version or bundler URL
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
}

export interface RenderPageResult {
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Gets unscaled page dimensions (at scale = 1.0)
 */
export async function getPageDimensions(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1.0 });
  return {
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Loads a PDF document from an ArrayBuffer or Blob
 */
export async function loadPdf(data: ArrayBuffer | Blob): Promise<pdfjsLib.PDFDocumentProxy> {
  let arrayBuffer: ArrayBuffer;
  if (data instanceof Blob) {
    arrayBuffer = await data.arrayBuffer();
  } else {
    arrayBuffer = data;
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/cmaps/`,
    cMapPacked: true,
  });

  return loadingTask.promise;
}

/**
 * Renders a specific page onto an HTMLCanvasElement with High-DPI crisp rendering
 */
export async function renderPage(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.5
): Promise<RenderPageResult> {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  
  // Calculate device pixel ratio for razor-sharp rendering on high-DPI and mobile retina displays
  const dpr = typeof window !== 'undefined' ? Math.max(window.devicePixelRatio || 1, 2) : 2;

  // Set internal canvas buffer to high-DPI resolution
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);

  // Set CSS display size to match viewport dimensions
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  // Fill crisp opaque white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const renderContext = {
    canvasContext: ctx,
    viewport: viewport,
    transform: [dpr, 0, 0, dpr, 0, 0] as [number, number, number, number, number, number],
  };

  await page.render(renderContext).promise;

  return {
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
  };
}

/**
 * Generates a high-resolution thumbnail image (Data URL) of the first page of a PDF
 */
export async function generateCoverThumbnail(
  data: ArrayBuffer | Blob,
  targetWidth: number = 720
): Promise<{ thumbnailDataUrl: string; pageCount: number }> {
  try {
    const pdfDoc = await loadPdf(data);
    const pageCount = pdfDoc.numPages;
    const page = await pdfDoc.getPage(1);
    
    // Ensure width is at least 600px for crisp rendering on high-density cards
    const effectiveWidth = Math.max(targetWidth, 600);
    const initialViewport = page.getViewport({ scale: 1.0 });
    const scale = effectiveWidth / initialViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Cannot get canvas 2d context');

    // Fill crisp opaque white background behind page
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
    }).promise;

    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.90);
    return { thumbnailDataUrl, pageCount };
  } catch (error) {
    console.error('Failed to generate cover thumbnail:', error);
    // Return placeholder
    return {
      thumbnailDataUrl: '',
      pageCount: 1,
    };
  }
}

/**
 * Creates a beautiful minimal sample PDF Blob directly in the browser
 * Allows instant testing of the app out of the box
 */
export function createSamplePdf(title: string, subtitle: string, pages: number = 3): Blob {
  // Generate a valid minimal PDF stream with custom text
  const safeTitle = title.replace(/[()\\]/g, '');
  const safeSub = subtitle.replace(/[()\\]/g, '');
  
  let objects = '';
  let offsets = [0];
  let currentOffset = 15; // after %PDF-1.4 header
  
  const addObj = (content: string) => {
    offsets.push(currentOffset);
    const str = `${offsets.length - 1} 0 obj\n${content}\nendobj\n`;
    currentOffset += str.length;
    objects += str;
  };

  // 1: Catalog
  addObj(`<< /Type /Catalog /Pages 2 0 R >>`);
  
  // 2: Pages
  const kids = Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ');
  addObj(`<< /Type /Pages /Kids [ ${kids} ] /Count ${pages} >>`);

  // Content for each page
  for (let i = 1; i <= pages; i++) {
    const pageObjNum = i + 2;
    const contentObjNum = pageObjNum + pages;
    
    // Page Object
    addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [ 0 0 612 792 ] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentObjNum} 0 R >>`);
  }

  // Content Streams for each page
  for (let i = 1; i <= pages; i++) {
    const stream = `BT
/F2 26 Tf
50 720 Td
(${safeTitle}) Tj
/F1 14 Tf
0 -40 Td
(${safeSub} - Page ${i} of ${pages}) Tj
0 -40 Td
(Tap the Note button on the top right to attach sticky notes to this page.) Tj
0 -30 Td
(Notes save automatically to your phone storage via IndexedDB.) Tj
0 -30 Td
(You can customize this document's cover, name, group, and visibility anytime!) Tj
ET`;
    const streamObj = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    addObj(streamObj);
  }

  const xrefOffset = currentOffset;
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < offsets.length; i++) {
    xref += offsets[i].toString().padStart(10, '0') + ' 00000 n \n';
  }

  const trailer = `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  const pdfString = `%PDF-1.4\n${objects}${xref}${trailer}`;

  return new Blob([pdfString], { type: 'application/pdf' });
}
