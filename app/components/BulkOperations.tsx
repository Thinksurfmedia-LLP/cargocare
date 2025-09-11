import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select } from "~/components/ui/select";

interface BulkOperationsProps {
  onExport: (type: string) => void;
  onImport: (type: string, file: File) => void;
  isLoading?: boolean;
  message?: string;
  errors?: string[];
}

export function BulkOperations({ onExport, onImport, isLoading, message, errors }: BulkOperationsProps) {
  const [selectedExportType, setSelectedExportType] = React.useState("");
  const [selectedImportType, setSelectedImportType] = React.useState("");
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);

  // All data types available for export
  const exportDataTypes = [
    { value: "shipment-plans", label: "📋 Shipment Plans" },
    { value: "liner-bookings", label: "🚢 Liner Bookings" },
    { value: "business-branches", label: "🏢 Business Branches" },
    { value: "carriers", label: "🚛 Carriers" },
    { value: "commodities", label: "📦 Commodities" },
    { value: "destination-countries", label: "🌍 Destination Countries" },
    { value: "equipment", label: "📋 Equipment" },
    { value: "loading-ports", label: "� Loading Ports" },
    { value: "organizations", label: "🏢 Organizations" },
    { value: "ports-of-discharge", label: "🏢 Ports of Discharge" },
    { value: "vessels", label: "🚢 Vessels" },
  ];

  // Only data points are available for import
  const importDataTypes = [
    { value: "business-branches", label: "🏢 Business Branches" },
    { value: "carriers", label: "� Carriers" },
    { value: "commodities", label: "📦 Commodities" },
    { value: "destination-countries", label: "🌍 Destination Countries" },
    { value: "equipment", label: "📋 Equipment" },
    { value: "loading-ports", label: "🚢 Loading Ports" },
    { value: "organizations", label: "🏢 Organizations" },
    { value: "ports-of-discharge", label: "🏢 Ports of Discharge" },
    { value: "vessels", label: "🚢 Vessels" },
  ];
  const handleExport = () => {
    if (selectedExportType) {
      onExport(selectedExportType);
    }
  };

  const handleImport = () => {
    if (selectedImportType && selectedFile) {
      onImport(selectedImportType, selectedFile);
      setSelectedFile(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📤</span>
            <span>Export Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">          <div className="space-y-2">
            <Label htmlFor="export-type">Select Data Type</Label>
            <Select
              id="export-type"
              value={selectedExportType}
              onChange={(e) => setSelectedExportType(e.target.value)}
            >
              <option value="">Choose data type to export...</option>
              {exportDataTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>
          
          <Button 
            onClick={handleExport}
            disabled={!selectedExportType || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Exporting...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span>📤</span>
                <span>Export CSV</span>
              </div>
            )}
          </Button>          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
            <p className="font-medium text-blue-800 mb-1">📝 Export Info:</p>
            <ul className="text-blue-700 space-y-1">
              <li>• <strong>Multi-row format:</strong> Arrays create multiple rows with same ID</li>
              <li>• <strong>JSON data flattening:</strong> Complex data fields (like data.reference_number) are expanded</li>
              <li>• Each array item gets its own row for easy analysis</li>
              <li>• Objects flattened with dot notation (e.g., data.reference_number, user.name)</li>
              <li>• Complex objects treated as array items when needed</li>
              <li>• Perfect for pivot tables and data analysis</li>
              <li>• Export/import fully compatible for round-trip editing (data points only)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📥</span>
            <span>Import Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">          <div className="space-y-2">
            <Label htmlFor="import-type">Select Data Type</Label>
            <Select
              id="import-type"
              value={selectedImportType}
              onChange={(e) => setSelectedImportType(e.target.value)}
            >
              <option value="">Choose data type to import...</option>
              {importDataTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-file">Select CSV File</Label>
            <Input
              id="import-file"
              type="file"
              accept=".csv"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              disabled={!selectedImportType}
            />
          </div>
          
          <Button 
            onClick={handleImport}
            disabled={!selectedImportType || !selectedFile || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Importing...</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <span>📥</span>
                <span>Import CSV</span>
              </div>
            )}
          </Button>          <div className="text-sm text-gray-600 bg-yellow-50 p-3 rounded-lg">
            <p className="font-medium text-yellow-800 mb-1">⚠️ Import Notes:</p>
            <ul className="text-yellow-700 space-y-1">
              <li>• <strong>Data Points only:</strong> Only reference data can be imported</li>
              <li>• <strong>Shipment Plans & Liner Bookings:</strong> Export-only (too complex for bulk import)</li>
              <li>• <strong>Fully compatible:</strong> Exported data point files can be edited and re-imported</li>
              <li>• Multi-row format automatically reconstructed to original structure</li>
              <li>• Dynamic field detection - any valid CSV columns accepted</li>
              <li>• Automatic type conversion (numbers, booleans, arrays)</li>
              <li>• Nested fields supported with dot notation</li>
              <li>• Required fields checked automatically</li>
              <li>• Process can't be undone - backup first!</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Messages */}
      {message && (
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-green-800 font-medium">{message}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Errors */}
      {errors && errors.length > 0 && (
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Import Errors</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <ul className="text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Format Examples */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>📋 CSV Format Examples</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Business Branches</p>
                <code className="text-gray-600">
                  name,code<br/>
                  "Head Office","HO"<br/>
                  "Branch 1","B1"
                </code>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Carriers</p>
                <code className="text-gray-600">
                  name<br/>
                  "MSC"<br/>
                  "Maersk"
                </code>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Loading Ports</p>
                <code className="text-gray-600">
                  name,country<br/>
                  "Port of Karachi","Pakistan"<br/>
                  "Port Qasim","Pakistan"
                </code>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Organizations</p>
                <code className="text-gray-600">
                  name,orgTypes<br/>
                  "ABC Corp","Shipper;Consignee"<br/>
                  "XYZ Ltd","Shipper"
                </code>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Commodities</p>
                <code className="text-gray-600">
                  name<br/>
                  "Cotton"<br/>
                  "Rice"
                </code>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="font-medium text-gray-800 mb-2">Equipment</p>
                <code className="text-gray-600">
                  name<br/>
                  "20ft Container"<br/>
                  "40ft Container"
                </code>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
