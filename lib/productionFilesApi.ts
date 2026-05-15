import { ProductionFileKind, ProductionFileMetadata } from '../types';

/**
 * Validates a PDF file for production intake (local check).
 */
export async function validateProductionFile(
  file: File,
  kind: ProductionFileKind
): Promise<{
  valid: boolean;
  error?: string;
  metadata?: Partial<ProductionFileMetadata>;
}> {
  if (!file) {
    return { valid: false, error: 'NO_FILE' };
  }

  // 1. MIME Type / Extension check
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    return { valid: false, error: 'INVALID_TYPE_REQUIRED_PDF' };
  }

  // 2. Empty file check
  if (file.size === 0) {
    return { valid: false, error: 'EMPTY_FILE' };
  }

  // 3. Size limit (500MB)
  const MAX_SIZE = 500 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return { valid: false, error: 'FILE_TOO_LARGE_MAX_500MB' };
  }

  return {
    valid: true,
    metadata: {
      kind,
      source_type: 'UPLOAD',
      filename: file.name,
      size_bytes: file.size,
      mime_type: 'application/pdf',
      status: 'SELECTED'
    }
  };
}

/**
 * Validates an external download link for production intake (v5.3).
 */
export async function validateProductionFileUrl(
  url: string,
  kind: ProductionFileKind
): Promise<{
  valid: boolean;
  error?: string;
  metadata?: Partial<ProductionFileMetadata>;
}> {
  if (!url || url.trim() === '') {
    return { valid: false, error: 'EMPTY_URL' };
  }

  try {
    const parsed = new URL(url);

    // 1. Require HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'SECURE_HTTPS_REQUIRED' };
    }

    // 2. Reject obvious local/internal hosts (SSRF Prevention)
    const hostname = parsed.hostname.toLowerCase();
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (
      localHosts.includes(hostname) ||
      hostname.startsWith('10.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.') ||
      hostname.endsWith('.local')
    ) {
      return { valid: false, error: 'INTERNAL_HOST_NOT_ALLOWED' };
    }

    // Note: No client-side fetch is performed here.
    // The link is treated as a declared source only.

    return {
      valid: true,
      metadata: {
        kind,
        source_type: 'DOWNLOAD_URL',
        download_url: url,
        download_url_host: hostname,
        status: 'LINK_PROVIDED',
        ingestion_status: 'NOT_STARTED'
      }
    };
  } catch (err) {
    return { valid: false, error: 'INVALID_URL_SYNTAX' };
  }
}

/**
 * Placeholder for backend upload integration.
 * In this phase, it throws error as real endpoint does not exist.
 */
export async function uploadProductionFile(
  file: File,
  kind: ProductionFileKind
): Promise<ProductionFileMetadata> {
  throw new Error(`UPLOAD_ENDPOINT_NOT_CONFIGURED: Cannot upload ${file.name} for ${kind}`);
}

/**
 * Placeholder for submitting the file intake declaration to the backend.
 */
export async function submitProductionFiles(
  metadata: { interior_pdf?: ProductionFileMetadata; cover_spine_back_pdf?: ProductionFileMetadata }
): Promise<{ success: boolean; order_ref?: string }> {
  if (!metadata.interior_pdf || !metadata.cover_spine_back_pdf) {
    throw new Error('SUBMIT_FAILED: Both required production files must be declared.');
  }

  throw new Error('SUBMIT_ENDPOINT_NOT_CONFIGURED: Use order request checkout flow instead.');
}
