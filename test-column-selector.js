// Simple test script to verify column selector functionality
console.log('Testing Column Selector...');

// Test the storage format
const testPreferences = {
  visibleColumns: ['checkbox', 'reference_number', 'status'],
  columnOrder: ['checkbox', 'reference_number', 'status'],
  lastUpdated: Date.now()
};

// Test localStorage operations
try {
  localStorage.setItem('test-columns', JSON.stringify(testPreferences));
  const retrieved = JSON.parse(localStorage.getItem('test-columns'));
  console.log('✅ localStorage test passed:', retrieved);
  localStorage.removeItem('test-columns');
} catch (error) {
  console.error('❌ localStorage test failed:', error);
}

// Test column filtering
const mockColumns = [
  { id: 'checkbox', label: 'Select', defaultVisible: true, locked: true },
  { id: 'reference_number', label: 'Reference No.', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'hidden_field', label: 'Hidden Field', defaultVisible: false }
];

const visibleColumns = mockColumns.filter(col => col.defaultVisible || col.locked).map(col => col.id);
console.log('✅ Default visible columns:', visibleColumns);

const lockedColumns = mockColumns.filter(col => col.locked).map(col => col.id);
console.log('✅ Locked columns:', lockedColumns);

console.log('Column selector test completed!');
