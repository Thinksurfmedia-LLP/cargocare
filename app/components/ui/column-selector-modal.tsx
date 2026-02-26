import React, { useState, useEffect } from 'react';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { Label } from './label';

interface Column {
  id: string;
  label: string;
  defaultVisible: boolean;
  locked?: boolean; // For columns that cannot be hidden (like checkbox, actions)
}

interface ColumnSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column[];
  visibleColumns: string[];
  onColumnChange: (columnIds: string[]) => void;
  onReset: () => void;
  title?: string;
}

export function ColumnSelectorModal({
  isOpen,
  onClose,
  columns,
  visibleColumns,
  onColumnChange,
  onReset,
  title = "Customize Columns"
}: ColumnSelectorModalProps) {
  const [localVisibleColumns, setLocalVisibleColumns] = useState<string[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  useEffect(() => {
    setLocalVisibleColumns([...visibleColumns]);
  }, [visibleColumns, isOpen]);

  const handleColumnToggle = (columnId: string) => {
    const column = columns.find(col => col.id === columnId);
    if (column?.locked) return; // Don't allow toggling locked columns

    setLocalVisibleColumns(prev => {
      if (prev.includes(columnId)) {
        // Remove from visible columns
        return prev.filter(id => id !== columnId);
      } else {
        // Add to visible columns - append at the end for now
        return [...prev, columnId];
      }
    });
  };

  const handleApply = () => {
    // Ensure locked columns are always included and in the right positions
    const lockedColumns = columns.filter(col => col.locked).map(col => col.id);
    
    // Create final column order: locked columns first, then user-ordered columns
    const nonLockedVisible = localVisibleColumns.filter(id => !lockedColumns.includes(id));
    const finalColumns = [...lockedColumns, ...nonLockedVisible];
    
    onColumnChange(finalColumns);
    onClose();
  };

  const handleReset = () => {
    const defaultColumns = columns.filter(col => col.defaultVisible || col.locked).map(col => col.id);
    setLocalVisibleColumns(defaultColumns);
    onReset();
    onClose();
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedItem(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropTargetId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === dropTargetId) {
      setDraggedItem(null);
      return;
    }

    // Only allow reordering of visible columns
    if (!localVisibleColumns.includes(draggedItem) || !localVisibleColumns.includes(dropTargetId)) {
      setDraggedItem(null);
      return;
    }

    setLocalVisibleColumns(prev => {
      const newOrder = [...prev];
      const draggedIndex = newOrder.indexOf(draggedItem);
      const targetIndex = newOrder.indexOf(dropTargetId);

      if (draggedIndex > -1 && targetIndex > -1) {
        // Remove the dragged item from its current position
        newOrder.splice(draggedIndex, 1);
        // Insert it at the target position
        newOrder.splice(targetIndex, 0, draggedItem);
      }

      return newOrder;
    });

    setDraggedItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-500 mt-1">Select and reorder columns to display</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 max-h-96 overflow-y-auto">
          <div className="space-y-3">
            <div className="text-sm text-gray-600 mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-blue-600">ℹ️</span>
                  <span className="font-medium text-blue-800">How to use:</span>
                </div>
                <ul className="text-sm text-blue-700 space-y-1 ml-6">
                  <li>• Check/uncheck boxes to show/hide columns</li>
                  <li>• Drag visible columns (blue background) to reorder</li>
                  <li>• Fixed columns (like Select and Reference No.) cannot be hidden or reordered</li>
                </ul>
              </div>
            </div>

            {/* Locked columns (always visible) */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <span className="mr-2">🔒</span>
                Fixed Columns
              </h4>
              {columns.filter(col => col.locked).map(column => (
                <div
                  key={column.id}
                  className="flex items-center space-x-3 p-3 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <Checkbox
                    checked={true}
                    disabled={true}
                    className="opacity-50"
                  />
                  <Label className="flex-1 text-sm text-gray-600">
                    {column.label}
                  </Label>
                  <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded-full">
                    Always visible
                  </span>
                </div>
              ))}
            </div>

            {/* Configurable columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-700 flex items-center">
                  <span className="mr-2">⚙️</span>
                  Configurable Columns
                </h4>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                  {localVisibleColumns.filter(id => !columns.find(col => col.id === id)?.locked).length} visible
                </span>
              </div>
              <div className="text-xs text-gray-500 mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <span className="text-yellow-600">💡</span> Check boxes to show/hide columns. Drag visible columns (blue) to reorder.
              </div>
              
              {/* Show visible columns first (in order) */}
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Visible Columns (in order)</h5>
                {localVisibleColumns
                  .filter(columnId => !columns.find(col => col.id === columnId)?.locked)
                  .map((columnId, index) => {
                    const column = columns.find(col => col.id === columnId);
                    if (!column) return null;
                    
                    return (
                      <div
                        key={columnId}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, columnId)}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDrop={(e) => handleDrop(e, columnId)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center space-x-3 p-3 border rounded-lg transition-all duration-200 cursor-move bg-blue-50 border-blue-200 hover:bg-blue-100 ${
                          draggedItem === columnId ? 'opacity-50 scale-105 shadow-lg ring-2 ring-blue-300' : ''
                        }`}
                        style={{
                          transform: draggedItem === columnId ? 'rotate(2deg)' : 'none'
                        }}
                      >
                        <span className="text-xs text-gray-500 w-6">#{index + 1}</span>
                        <Checkbox
                          checked={true}
                          onChange={() => handleColumnToggle(columnId)}
                        />
                        <Label className="flex-1 select-none cursor-move font-medium">
                          {column.label}
                        </Label>
                        <div className="flex items-center space-x-1 text-blue-600">
                          <span className="text-xs">⋮⋮</span>
                          <span className="text-xs hidden sm:inline">Drag</span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Show hidden columns */}
              <div className="space-y-2">
                <h5 className="text-xs font-medium text-gray-600 uppercase tracking-wide">Hidden Columns</h5>
                {columns
                  .filter(col => !col.locked && !localVisibleColumns.includes(col.id))
                  .map(column => (
                    <div
                      key={column.id}
                      className="flex items-center space-x-3 p-3 border rounded-lg transition-all duration-200 bg-gray-50 border-gray-200 hover:bg-gray-100"
                    >
                      <span className="text-xs text-gray-400 w-6">—</span>
                      <Checkbox
                        checked={false}
                        onChange={() => handleColumnToggle(column.id)}
                      />
                      <Label className="flex-1 select-none cursor-pointer">
                        {column.label}
                      </Label>
                      <span className="text-xs text-gray-400 bg-gray-200 px-2 py-1 rounded-full">Hidden</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            {/* <div className="flex items-center space-x-2 text-xs text-gray-500">
              <span>💾</span>
              <span>Preferences saved automatically</span>
            </div> */}
            <div className="flex space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                className="text-sm"
              >
                Reset to Default
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="text-sm"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleApply}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white"
              >
                Apply Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
