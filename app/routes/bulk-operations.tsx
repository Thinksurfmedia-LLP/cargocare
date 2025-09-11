import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useActionData, useNavigation, Form } from "react-router";
import { requireAuth } from "~/lib/auth.server";
import { AdminLayout } from "~/components/AdminLayout";
import { BulkOperations } from "~/components/BulkOperations";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Bulk Operations - Cargo Care" },
    { name: "description", content: "Bulk import and export data" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow ADMIN users
    if (user.role.name !== "ADMIN") {
      throw new Response("Unauthorized", { status: 403 });
    }

    return { user };
  } catch (error) {
    throw error;
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const user = await requireAuth(request);
    
    // Only allow ADMIN users
    if (user.role.name !== "ADMIN") {
      return { error: "Unauthorized" };
    }

    const formData = await request.formData();
    const action = formData.get("action") as string;

    if (action === "import") {
      const type = formData.get("type") as string;
      const file = formData.get("file") as File;

      if (!type || !file) {
        return { error: "Type and file are required" };
      }

      // Forward to bulk operations API
      const bulkFormData = new FormData();
      bulkFormData.append("type", type);
      bulkFormData.append("file", file);

      const response = await fetch(`${request.url.split('/bulk-operations')[0]}/api/bulk-operations`, {
        method: "POST",
        body: bulkFormData,
      });

      const result = await response.json();
      return result;
    }

    return { error: "Invalid action" };
  } catch (error) {
    console.error("Bulk operations action error:", error);
    return { error: "An error occurred" };
  }
}

export default function BulkOperationsPage() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [pendingExport, setPendingExport] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const isLoading = navigation.state === "submitting" || pendingExport !== null;
  const handleExport = async (type: string) => {
    setPendingExport(type);
    try {
      const response = await fetch(`/api/bulk-operations?type=${type}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${type}-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        // Show success message
        setExportMessage(`✅ Successfully exported ${type} data!`);
        setTimeout(() => setExportMessage(null), 5000);
      } else {
        setExportMessage(`❌ Failed to export ${type} data. Please try again.`);
        setTimeout(() => setExportMessage(null), 5000);
      }
    } catch (error) {
      console.error("Export error:", error);
      setExportMessage(`❌ Export failed due to network error. Please try again.`);
      setTimeout(() => setExportMessage(null), 5000);
    } finally {
      setPendingExport(null);
    }
  };

  const handleImport = (type: string, file: File) => {
    const formData = new FormData();
    formData.append("action", "import");
    formData.append("type", type);
    formData.append("file", file);

    // Submit via form
    const form = document.createElement("form");
    form.method = "POST";
    form.style.display = "none";
    
    for (const [key, value] of formData.entries()) {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      if (value instanceof File) {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.name = key;
        fileInput.files = new DataTransfer().files;
        const dt = new DataTransfer();
        dt.items.add(value);
        fileInput.files = dt.files;
        form.appendChild(fileInput);
      } else {
        input.value = value;
        form.appendChild(input);
      }
    }
    
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  return (
    <AdminLayout user={user}>
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
                  <span>📊</span>
                  <span>Bulk Operations</span>
                </h1>
                <p className="text-gray-600 mt-2">
                  Import and export data in bulk for efficient data management
                </p>
              </div>
            </div>
          </div>

          {/* Admin Warning */}
          <div className="mb-6 bg-red-50 border border-red-200 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <span className="text-red-600">⚠️</span>
              <p className="text-red-800 font-medium">
                Admin Only Feature - These operations affect system-wide data
              </p>
            </div>
            <p className="text-red-700 text-sm mt-1">
              Please ensure you have proper backups before performing bulk imports
            </p>
          </div>

          {/* Bulk Operations Component */}          <BulkOperations
            onExport={handleExport}
            onImport={handleImport}
            isLoading={isLoading}
            message={actionData?.success || exportMessage}
            errors={actionData?.errors}
          />

          {/* Usage Guidelines */}
          <div className="mt-8 bg-blue-50 border border-blue-200 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-900 mb-4">📚 Usage Guidelines</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">              <div>
                <h4 className="font-medium text-blue-800 mb-2">Export Guidelines:</h4>
                <ul className="text-blue-700 space-y-1">
                  <li>• <strong>Multi-row format:</strong> Arrays create multiple rows</li>
                  <li>• Same ID repeated for each array item (like product variants)</li>
                  <li>• Perfect for pivot tables and advanced analysis</li>
                  <li>• Objects flattened with dot notation</li>
                  <li>• Export/import compatible for round-trip editing</li>
                  <li>• Files timestamped for version control</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-blue-800 mb-2">Import Guidelines:</h4>
                <ul className="text-blue-700 space-y-1">
                  <li>• Robust CSV parsing handles complex data</li>
                  <li>• Dynamic field detection accepts any valid columns</li>
                  <li>• Automatic type conversion and validation</li>
                  <li>• Graceful error handling with detailed feedback</li>
                  <li>• Schema changes automatically supported</li>
                </ul>
              </div>
            </div>
          </div>          {/* Export Format Example */}
          <div className="mt-8 bg-green-50 border border-green-200 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-green-900 mb-4">📊 Multi-Row Export Format Example</h3>
            <div className="text-sm">
              <p className="text-green-800 mb-3">
                <strong>How arrays are handled:</strong> Each array item creates a new row with the same ID, enabling powerful data analysis.
              </p>
              <div className="bg-white border rounded p-4 font-mono text-xs overflow-x-auto">
                <div className="text-gray-600 mb-2">Example: Shipment Plan with multiple containers</div>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-1">id</th>
                      <th className="text-left p-1">data.reference_number</th>
                      <th className="text-left p-1">data.containers.number</th>
                      <th className="text-left p-1">data.containers.size</th>
                      <th className="text-left p-1">data.containers.type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-1">SP-001</td>
                      <td className="p-1">REF-12345</td>
                      <td className="p-1">CONT-001</td>
                      <td className="p-1">20ft</td>
                      <td className="p-1">Dry</td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-1">SP-001</td>
                      <td className="p-1">REF-12345</td>
                      <td className="p-1">CONT-002</td>
                      <td className="p-1">40ft</td>
                      <td className="p-1">Refrigerated</td>
                    </tr>
                    <tr>
                      <td className="p-1">SP-001</td>
                      <td className="p-1">REF-12345</td>
                      <td className="p-1">CONT-003</td>
                      <td className="p-1">20ft</td>
                      <td className="p-1">Dry</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-green-700 mt-3 text-sm">
                ✅ <strong>Round-trip compatible:</strong> Export → Edit in Excel → Import works seamlessly!
              </p>
              <p className="text-green-700 mt-2 text-sm">
                📝 <strong>Editing tip:</strong> You can modify any field values, add/remove rows for array items, and re-import without errors.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">🚀 Quick Export</h4>
              <p className="text-sm text-gray-600 mb-3">
                Export all data points at once for backup
              </p>
              <button
                onClick={() => {
                  ['business-branches', 'carriers', 'commodities', 'destination-countries', 'equipment', 'loading-ports', 'organizations', 'ports-of-discharge', 'vessels']
                    .forEach(type => handleExport(type));
                }}
                disabled={isLoading}
                className="text-sm bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Export All Data Points
              </button>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">📋 Export Plans</h4>
              <p className="text-sm text-gray-600 mb-3">
                Export shipment plans for analysis
              </p>
              <button
                onClick={() => handleExport('shipment-plans')}
                disabled={isLoading}
                className="text-sm bg-green-500 text-white px-3 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                Export Shipment Plans
              </button>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-gray-900 mb-2">🚢 Export Bookings</h4>
              <p className="text-sm text-gray-600 mb-3">
                Export liner bookings for analysis
              </p>
              <button
                onClick={() => handleExport('liner-bookings')}
                disabled={isLoading}
                className="text-sm bg-purple-500 text-white px-3 py-2 rounded hover:bg-purple-600 disabled:opacity-50"
              >
                Export Liner Bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
