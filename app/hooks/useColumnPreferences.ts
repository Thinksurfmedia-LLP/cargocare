import { useState, useEffect, useRef, useMemo } from 'react';

interface Column {
  id: string;
  label: string;
  defaultVisible: boolean;
  locked?: boolean;
}

interface UseColumnPreferencesProps {
  storageKey: string;
  columns: Column[];
}

interface StoredPreferences {
  visibleColumns: string[];
  columnOrder: string[];
  lastUpdated: number;
}

export function useColumnPreferences({ storageKey, columns }: UseColumnPreferencesProps) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const initializedRef = useRef(false);

  // Memoize default columns to prevent unnecessary recalculation
  const defaultColumns = useMemo(() => {
    if (!columns || columns.length === 0) return [];
    return columns.filter(col => col.defaultVisible || col.locked).map(col => col.id);
  }, [columns]);

  // Initialize columns only once
  useEffect(() => {
    if (!columns || columns.length === 0 || initializedRef.current) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const preferences: StoredPreferences = JSON.parse(stored);
        
        // Validate that all stored columns still exist in the current column definitions
        const validColumns = preferences.visibleColumns?.filter(id => 
          columns.some(col => col.id === id)
        ) || [];
        
        // Ensure locked columns are always included
        const lockedColumns = columns.filter(col => col.locked).map(col => col.id);
        
        // Merge with order preference
        let orderedColumns: string[] = [];
        
        // First, add columns in their stored order
        if (preferences.columnOrder && Array.isArray(preferences.columnOrder)) {
          preferences.columnOrder.forEach(id => {
            if (validColumns.includes(id) || lockedColumns.includes(id)) {
              if (!orderedColumns.includes(id)) {
                orderedColumns.push(id);
              }
            }
          });
        }
        
        // Then add any remaining visible columns that weren't in the order
        validColumns.forEach(id => {
          if (!orderedColumns.includes(id)) {
            orderedColumns.push(id);
          }
        });
        
        // Ensure locked columns are included
        lockedColumns.forEach(id => {
          if (!orderedColumns.includes(id)) {
            orderedColumns.unshift(id); // Add locked columns at the beginning
          }
        });
        
        if (orderedColumns.length > 0) {
          setVisibleColumns(orderedColumns);
        } else {
          setVisibleColumns(defaultColumns);
        }
      } else {
        // No stored preferences, use defaults
        setVisibleColumns(defaultColumns);
      }
    } catch (error) {
      console.error('Failed to load column preferences:', error);
      // Reset to default on error
      setVisibleColumns(defaultColumns);
    }
    
    initializedRef.current = true;
  }, [storageKey, columns, defaultColumns]);

  // Save preferences to localStorage when they change
  const updateColumnPreferences = (newColumns: string[]) => {
    if (!columns || columns.length === 0) return;
    
    try {
      // Ensure locked columns are always included
      const lockedColumns = columns.filter(col => col.locked).map(col => col.id);
      const finalColumns = [...lockedColumns, ...newColumns.filter(id => !lockedColumns.includes(id))];
      
      setVisibleColumns(finalColumns);
      
      const preferences: StoredPreferences = {
        visibleColumns: finalColumns,
        columnOrder: finalColumns,
        lastUpdated: Date.now()
      };
      
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch (error) {
      console.error('Failed to save column preferences:', error);
    }
  };

  // Reset to default preferences
  const resetColumnPreferences = () => {
    if (!columns || columns.length === 0) return;
    
    setVisibleColumns(defaultColumns);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to reset column preferences:', error);
    }
  };

  // Check if a column is visible
  const isColumnVisible = (columnId: string) => {
    return visibleColumns.includes(columnId);
  };

  // Get ordered columns based on user preferences
  const getOrderedColumns = () => {
    if (!columns || columns.length === 0) return [];
    
    const orderedColumns: Column[] = [];
    
    // Add columns in the order they appear in visibleColumns
    visibleColumns.forEach(columnId => {
      const column = columns.find(col => col.id === columnId);
      if (column) {
        orderedColumns.push(column);
      }
    });
    
    return orderedColumns;
  };

  // Get column position for reordering
  const getColumnPosition = (columnId: string) => {
    return visibleColumns.indexOf(columnId);
  };

  // Move column to a new position
  const moveColumn = (columnId: string, newPosition: number) => {
    if (!columns || columns.length === 0) return;
    
    const newOrder = [...visibleColumns];
    const currentIndex = newOrder.indexOf(columnId);
    
    if (currentIndex > -1) {
      newOrder.splice(currentIndex, 1);
      newOrder.splice(newPosition, 0, columnId);
      updateColumnPreferences(newOrder);
    }
  };

  return {
    visibleColumns,
    isColumnModalOpen,
    setIsColumnModalOpen,
    updateColumnPreferences,
    resetColumnPreferences,
    isColumnVisible,
    getOrderedColumns,
    getColumnPosition,
    moveColumn
  };
}
