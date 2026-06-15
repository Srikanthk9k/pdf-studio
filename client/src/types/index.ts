export type ToolType =
  | 'select'
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'pen'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'image'
  | 'eraser'
  | 'sticky-note'
  | 'form-text'
  | 'form-checkbox'
  | 'form-radio'
  | 'form-dropdown'
  | 'form-signature'
  | 'signature'
  | 'redact'
  | 'none';

export type AnnotationType =
  | 'text'
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'drawing'
  | 'rectangle'
  | 'circle'
  | 'arrow'
  | 'line'
  | 'image'
  | 'sticky-note'
  | 'signature'
  | 'redaction'
  | 'form-field';

export interface Annotation {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  fabricObjectJson: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface Page {
  index: number;
  rotation: number;
  width: number;
  height: number;
}

export interface FormField {
  id: string;
  fieldType: 'text' | 'checkbox' | 'radio' | 'dropdown' | 'signature';
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  value: string | boolean;
  options?: string[];
}

export interface Signature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: string;
}

export interface ConversionJob {
  jobId: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  inputFormat: string;
  outputFormat: string;
  downloadUrl?: string;
  error?: string;
}

export interface ShareLink {
  token: string;
  url: string;
  expiresAt: string;
}

export interface EditorState {
  document: {
    id: string;
    name: string;
    pages: Page[];
    totalPages: number;
    currentPage: number;
    zoom: number;
    rotation: number;
    fileUrl: string | null;
    fileBytes: ArrayBuffer | null;
  };
  activeTool: ToolType;
  annotations: Annotation[];
  history: { past: Annotation[][]; future: Annotation[][] };
  selectedElement: Annotation | null;
  properties: {
    fontFamily: string;
    fontSize: number;
    color: string;
    opacity: number;
    strokeWidth: number;
    fillColor: string;
    textAlign: 'left' | 'center' | 'right';
  };
  settings: {
    theme: 'dark' | 'light';
    autoSave: boolean;
    showThumbnails: boolean;
    showProperties: boolean;
  };
  signatures: Signature[];
  formFields: FormField[];
  isLoading: boolean;
  loadingMessage: string;
}

export interface UploadResponse {
  fileId: string;
  name: string;
  size: number;
  pages: number;
  url: string;
}

export interface CompressOptions {
  fileId: string;
  quality: 'low' | 'medium' | 'high';
}

export interface ProtectOptions {
  fileId: string;
  userPassword: string;
  ownerPassword: string;
  permissions: {
    printing: boolean;
    copying: boolean;
    editing: boolean;
    annotating: boolean;
  };
}

export interface MergeOptions {
  fileIds: string[];
}

export interface SplitOptions {
  fileId: string;
  ranges: Array<{ start: number; end: number }>;
}
