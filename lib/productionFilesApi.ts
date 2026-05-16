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
 * Performs a real upload to the backend (v5.3).
 */
export async function uploadProductionFile(
  file: File,
  kind: ProductionFileKind,
  context?: { cart_id?: string; session_id?: string; order_intent_id?: string; user_id?: string }
): Promise<ProductionFileMetadata> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('role', kind === 'INTERIOR_PDF' ? 'INTERIOR_PDF' : 'COVER_PDF');
  
  if (context?.cart_id) formData.append('cart_id', context.cart_id);
  if (context?.session_id) formData.append('session_id', context.session_id);
  if (context?.order_intent_id) formData.append('order_intent_id', context.order_intent_id);
  if (context?.user_id) formData.append('user_id', context.user_id);

  const response = await fetch('/api/production-files/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Upload failed with status ${response.status}`);
  }

  const data = await response.json();
  
  return {
    kind,
    file_id: data.file_id,
    filename: data.filename,
    size_bytes: data.size_bytes,
    mime_type: data.mime_type,
    status: data.status,
    source_type: 'UPLOAD',
    checksum: data.checksum,
    validation: data.validation,
    storage_url: data.storage_url,
    created_at: data.created_at
  };
}

/**
 * Lists production files from the server registry based on associations (v5.3 - Phase 3).
 */
export async function listProductionFiles(params: {
  cart_id?: string;
  session_id?: string;
  order_ref?: string;
  user_id?: string;
}): Promise<ProductionFileMetadata[]> {
  const query = new URLSearchParams();
  if (params.cart_id) query.append('cart_id', params.cart_id);
  if (params.session_id) query.append('session_id', params.session_id);
  if (params.order_ref) query.append('order_ref', params.order_ref);
  if (params.user_id) query.append('user_id', params.user_id);

  const response = await fetch(`/api/production-files?${query.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch production files from registry.');
  }

  const data = await response.json();
  return data.files || [];
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
