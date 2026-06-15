import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { X, List, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useEditorStore, selectFormFieldsForPage } from '../store/editorStore';
import type { FormField } from '../types';

const FIELD_TYPES: FormField['fieldType'][] = ['text', 'checkbox', 'radio', 'dropdown', 'signature'];

const FIELD_TYPE_COLORS: Record<FormField['fieldType'], string> = {
  text: 'bg-blue-500/20 text-blue-300',
  checkbox: 'bg-green-500/20 text-green-300',
  radio: 'bg-purple-500/20 text-purple-300',
  dropdown: 'bg-amber-500/20 text-amber-300',
  signature: 'bg-indigo-500/20 text-indigo-300',
};

interface FormBuilderProps {
  onClose?: () => void;
}

export default function FormBuilder({ onClose }: FormBuilderProps) {
  const { document: doc, formFields, updateFormField, removeFormField, setActiveTool } =
    useEditorStore();
  const currentPageFields = useEditorStore(selectFormFieldsForPage(doc.currentPage - 1));

  const [fillMode, setFillMode] = useState(false);
  const [fillValues, setFillValues] = useState<Record<string, string | boolean>>({});

  const handleSelectFieldType = (type: FormField['fieldType']) => {
    setActiveTool(`form-${type}` as Parameters<typeof setActiveTool>[0]);
    toast.success(`Click on the PDF to place a ${type} field`);
  };

  const handleFillModeToggle = () => {
    setFillMode((prev) => !prev);
    toast.success(fillMode ? 'Edit mode' : 'Fill mode active — click fields to fill');
  };

  const handleSaveForm = () => {
    toast.success('Form data saved!');
    // In production: POST to /api/fill-form with fillValues
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <List className="w-4 h-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-slate-200">Form Builder</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFillModeToggle}
            title={fillMode ? 'Switch to edit mode' : 'Switch to fill mode'}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
              fillMode
                ? 'bg-indigo-500/20 text-indigo-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
            }`}
          >
            {fillMode ? (
              <ToggleRight className="w-4 h-4" />
            ) : (
              <ToggleLeft className="w-4 h-4" />
            )}
            {fillMode ? 'Fill Mode' : 'Edit Mode'}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-slate-600 hover:text-slate-300">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Field type selector (only in edit mode) */}
      {!fillMode && (
        <div className="p-3 border-b border-slate-700">
          <p className="text-xs text-slate-500 mb-2">Add Field</p>
          <div className="flex flex-wrap gap-1.5">
            {FIELD_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => handleSelectFieldType(type)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize transition-all duration-150 ${FIELD_TYPE_COLORS[type]} hover:scale-105`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Field list */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="text-xs text-slate-500 mb-2">
          Page {doc.currentPage} fields ({currentPageFields.length})
        </p>

        {currentPageFields.length === 0 && (
          <p className="text-xs text-slate-600 text-center py-4">
            No fields on this page. Select a field type above and click on the PDF to add.
          </p>
        )}

        <div className="space-y-2">
          {currentPageFields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800 border border-slate-700"
            >
              {/* Type badge */}
              <span
                className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize flex-shrink-0 ${FIELD_TYPE_COLORS[field.fieldType]}`}
              >
                {field.fieldType}
              </span>

              {/* Label / Fill input */}
              {fillMode ? (
                field.fieldType === 'checkbox' ? (
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(fillValues[field.id])}
                      onChange={(e) =>
                        setFillValues((prev) => ({ ...prev, [field.id]: e.target.checked }))
                      }
                      className="rounded border-slate-600 bg-slate-700 text-indigo-500"
                    />
                    <span className="text-sm text-slate-300">{field.label}</span>
                  </label>
                ) : (
                  <input
                    type="text"
                    value={(fillValues[field.id] as string) || ''}
                    onChange={(e) =>
                      setFillValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                    placeholder={field.label}
                    className="studio-input text-xs py-1 flex-1"
                  />
                )
              ) : (
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) => updateFormField(field.id, { label: e.target.value })}
                  className="studio-input text-xs py-1 flex-1"
                />
              )}

              {/* Delete */}
              {!fillMode && (
                <button
                  onClick={() => {
                    removeFormField(field.id);
                    toast.success('Field removed');
                  }}
                  className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-slate-700 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Save button (fill mode) */}
      {fillMode && currentPageFields.length > 0 && (
        <div className="p-3 border-t border-slate-700">
          <button onClick={handleSaveForm} className="btn-primary w-full justify-center">
            Save Form Data
          </button>
        </div>
      )}
    </div>
  );
}
