import { useCallback } from 'react';
import { useEditorStore, selectCanUndo, selectCanRedo } from '../store/editorStore';

interface UseHistoryReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory(): UseHistoryReturn {
  const store = useEditorStore();
  const canUndo = useEditorStore(selectCanUndo);
  const canRedo = useEditorStore(selectCanRedo);

  const undo = useCallback(() => {
    store.undo();
  }, [store]);

  const redo = useCallback(() => {
    store.redo();
  }, [store]);

  return { undo, redo, canUndo, canRedo };
}
