import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  EditorState,
  Annotation,
  ToolType,
  Page,
  Signature,
  FormField,
} from '../types';

// ─── Actions interface ───────────────────────────────────────────────────────
interface EditorActions {
  // Document
  setDocument: (doc: Partial<EditorState['document']>) => void;
  setCurrentPage: (page: number) => void;
  setZoom: (zoom: number) => void;
  resetDocument: () => void;

  // Tool
  setActiveTool: (tool: ToolType) => void;

  // Annotations
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotationsForPage: (pageIndex: number) => void;

  // History
  undo: () => void;
  redo: () => void;

  // Selection & Properties
  setSelectedElement: (el: Annotation | null) => void;
  updateProperties: (props: Partial<EditorState['properties']>) => void;

  // Settings
  toggleTheme: () => void;
  updateSettings: (settings: Partial<EditorState['settings']>) => void;

  // Loading
  setLoading: (loading: boolean, message?: string) => void;

  // Signatures
  addSignature: (sig: Signature) => void;
  removeSignature: (id: string) => void;

  // Form fields
  addFormField: (field: FormField) => void;
  updateFormField: (id: string, patch: Partial<FormField>) => void;
  removeFormField: (id: string) => void;
}

// ─── Default state ───────────────────────────────────────────────────────────
const defaultDocument: EditorState['document'] = {
  id: '',
  name: 'Untitled.pdf',
  pages: [],
  totalPages: 0,
  currentPage: 1,
  zoom: 1,
  rotation: 0,
  fileUrl: null,
  fileBytes: null,
};

const defaultProperties: EditorState['properties'] = {
  fontFamily: 'Inter',
  fontSize: 16,
  color: '#6366f1',
  opacity: 1,
  strokeWidth: 2,
  fillColor: 'rgba(99,102,241,0.2)',
  textAlign: 'left',
};

const defaultSettings: EditorState['settings'] = {
  theme: 'dark',
  autoSave: true,
  showThumbnails: true,
  showProperties: true,
};

// ─── Helper: push to history ─────────────────────────────────────────────────
function pushHistory(
  history: EditorState['history'],
  currentAnnotations: Annotation[]
): EditorState['history'] {
  return {
    past: [...history.past, currentAnnotations].slice(-50), // keep last 50 states
    future: [],
  };
}

// ─── Store ───────────────────────────────────────────────────────────────────
export const useEditorStore = create<EditorState & EditorActions>()(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────────────────
      document: defaultDocument,
      activeTool: 'select',
      annotations: [],
      history: { past: [], future: [] },
      selectedElement: null,
      properties: defaultProperties,
      settings: defaultSettings,
      signatures: [],
      formFields: [],
      isLoading: false,
      loadingMessage: '',

      // ── Document actions ─────────────────────────────────────────────────────
      setDocument: (doc) =>
        set((state) => ({
          document: { ...state.document, ...doc },
        })),

      setCurrentPage: (page) =>
        set((state) => ({
          document: { ...state.document, currentPage: page },
        })),

      setZoom: (zoom) =>
        set((state) => ({
          document: {
            ...state.document,
            zoom: Math.max(0.25, Math.min(5, zoom)),
          },
        })),

      resetDocument: () =>
        set({
          document: defaultDocument,
          annotations: [],
          history: { past: [], future: [] },
          selectedElement: null,
          formFields: [],
        }),

      // ── Tool ─────────────────────────────────────────────────────────────────
      setActiveTool: (tool) => set({ activeTool: tool }),

      // ── Annotations ──────────────────────────────────────────────────────────
      addAnnotation: (annotation) => {
        const state = get();
        const newHistory = pushHistory(state.history, state.annotations);
        set({
          annotations: [...state.annotations, annotation],
          history: newHistory,
        });
      },

      updateAnnotation: (id, patch) => {
        const state = get();
        const newHistory = pushHistory(state.history, state.annotations);
        set({
          annotations: state.annotations.map((a) =>
            a.id === id ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a
          ),
          history: newHistory,
        });
      },

      removeAnnotation: (id) => {
        const state = get();
        const newHistory = pushHistory(state.history, state.annotations);
        set({
          annotations: state.annotations.filter((a) => a.id !== id),
          history: newHistory,
          selectedElement:
            state.selectedElement?.id === id ? null : state.selectedElement,
        });
      },

      clearAnnotationsForPage: (pageIndex) => {
        const state = get();
        const newHistory = pushHistory(state.history, state.annotations);
        set({
          annotations: state.annotations.filter(
            (a) => a.pageIndex !== pageIndex
          ),
          history: newHistory,
        });
      },

      // ── History ───────────────────────────────────────────────────────────────
      undo: () => {
        const { history, annotations } = get();
        if (history.past.length === 0) return;
        const previous = history.past[history.past.length - 1];
        set({
          annotations: previous,
          history: {
            past: history.past.slice(0, -1),
            future: [annotations, ...history.future].slice(0, 50),
          },
          selectedElement: null,
        });
      },

      redo: () => {
        const { history, annotations } = get();
        if (history.future.length === 0) return;
        const next = history.future[0];
        set({
          annotations: next,
          history: {
            past: [...history.past, annotations].slice(0, 50),
            future: history.future.slice(1),
          },
          selectedElement: null,
        });
      },

      // ── Selection ─────────────────────────────────────────────────────────────
      setSelectedElement: (el) => set({ selectedElement: el }),

      updateProperties: (props) =>
        set((state) => ({
          properties: { ...state.properties, ...props },
        })),

      // ── Settings ──────────────────────────────────────────────────────────────
      toggleTheme: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            theme: state.settings.theme === 'dark' ? 'light' : 'dark',
          },
        })),

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      // ── Loading ───────────────────────────────────────────────────────────────
      setLoading: (loading, message = '') =>
        set({ isLoading: loading, loadingMessage: message }),

      // ── Signatures ────────────────────────────────────────────────────────────
      addSignature: (sig) =>
        set((state) => ({
          signatures: [sig, ...state.signatures].slice(0, 10),
        })),

      removeSignature: (id) =>
        set((state) => ({
          signatures: state.signatures.filter((s) => s.id !== id),
        })),

      // ── Form Fields ───────────────────────────────────────────────────────────
      addFormField: (field) =>
        set((state) => ({
          formFields: [...state.formFields, field],
        })),

      updateFormField: (id, patch) =>
        set((state) => ({
          formFields: state.formFields.map((f) =>
            f.id === id ? { ...f, ...patch } : f
          ),
        })),

      removeFormField: (id) =>
        set((state) => ({
          formFields: state.formFields.filter((f) => f.id !== id),
        })),
    }),
    {
      name: 'pdf-studio-editor',
      storage: createJSONStorage(() => localStorage),
      // Only persist settings and signatures (not large binary data)
      partialize: (state) => ({
        settings: state.settings,
        signatures: state.signatures,
        properties: state.properties,
      }),
    }
  )
);

// ── Derived selectors ─────────────────────────────────────────────────────────
export const selectAnnotationsForPage = (pageIndex: number) => (state: EditorState & EditorActions) =>
  state.annotations.filter((a) => a.pageIndex === pageIndex);

export const selectFormFieldsForPage = (pageIndex: number) => (state: EditorState & EditorActions) =>
  state.formFields.filter((f) => f.pageIndex === pageIndex);

export const selectCanUndo = (state: EditorState & EditorActions) =>
  state.history.past.length > 0;

export const selectCanRedo = (state: EditorState & EditorActions) =>
  state.history.future.length > 0;

// Re-export Page type for convenience
export type { Page };
