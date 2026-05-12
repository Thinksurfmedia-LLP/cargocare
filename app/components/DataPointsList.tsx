import { Form, Link, useLoaderData, useNavigation, useActionData } from "react-router";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { AdminLayout } from "~/components/AdminLayout";
import { useState } from "react";

interface DataPointItem {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any; // For additional fields like code, country, etc.
}

interface DataPointsProps {
  title: string;
  icon: string;
  description: string;
  basePath: string;
  items: DataPointItem[];
  user: any;
  actionData?: any;
  columns: {
    key: string;
    label: string;
    render?: (value: any, item: DataPointItem) => React.ReactNode;
  }[];
}

export function DataPointsList({ title, icon, description, basePath, items, user, actionData, columns }: DataPointsProps) {
  const navigation = useNavigation();
  const isDeleting = navigation.state === "submitting" && navigation.formMethod === "DELETE";

  const [searchTerm, setSearchTerm] = useState("");

  const filteredItems = items.filter(item =>
    Object.values(item).some(value =>
      value?.toString().toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  return (
    <AdminLayout user={user}>
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6 py-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">{icon}</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
                <p className="text-sm text-gray-600 mt-1">{description}</p>
              </div>
            </div>
            <Link 
              to={`${basePath}/new`}
              className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
            >
              <span className="mr-2">+</span>
              Add New
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white">
        {actionData?.error && (
          <div className="m-4 shrink-0 bg-red-50 border-l-4 border-red-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 font-medium">Error</p>
                <p className="text-sm text-red-600 mt-1">{actionData.error}</p>
              </div>
            </div>
          </div>
        )}

        {actionData?.success && (
          <div className="m-4 shrink-0 bg-green-50 border-l-4 border-green-400 p-4 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-green-400 text-xl">✅</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700 font-medium">Success</p>
                <p className="text-sm text-green-600 mt-1">{actionData.success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Unified Table Container */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white">
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200 shrink-0">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex-1 max-w-2xl">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-400 text-sm">🔍</span>
                  </div>
                  <Input
                    id="search"
                    type="text"
                    placeholder={`Search ${title.toLowerCase()}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-1.5 h-8 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                  />
                </div>
              </div>
              <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-lg shrink-0">
                Showing <span className="font-medium">{filteredItems.length}</span> of <span className="font-medium">{items.length}</span> {title.toLowerCase()}
              </div>
            </div>
          </div>

          <div className="px-4 py-2 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title} List</h3>
                <p className="text-sm text-gray-500">Manage your {title.toLowerCase()}</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-scroll overflow-y-auto flex-1 min-h-0 custom-scrollbar pb-2">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        {column.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-6xl mb-4">{icon}</span>
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No {title.toLowerCase()} found</h3>
                          <p className="text-gray-500 mb-4">
                            {searchTerm ? `No results found for "${searchTerm}"` : `Get started by creating your first ${title.toLowerCase().slice(0, -1)}`}
                          </p>
                          <Link 
                            to={`${basePath}/new`}
                            className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-all duration-200"
                          >
                            <span className="mr-2">+</span>
                            Add New {title.slice(0, -1)}
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors duration-200">
                        {columns.map((column) => (
                          <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {column.render ? column.render(item[column.key], item) : item[column.key]}
                          </td>
                        ))}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <Link
                              to={`${basePath}/${item.id}/edit`}
                              className="text-blue-600 hover:text-blue-500 font-medium transition-colors duration-200"
                            >
                              Edit
                            </Link>                            <Form method="post" className="inline">
                              <input type="hidden" name="intent" value="delete" />
                              <input type="hidden" name="id" value={item.id} />
                              <Button
                                type="submit"
                                variant="destructive"
                                size="sm"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  if (!confirm(`Are you sure you want to delete this ${title.toLowerCase().slice(0, -1)}?`)) {
                                    e.preventDefault();
                                  }
                                }}
                              >
                                {isDeleting ? "Deleting..." : "Delete"}
                              </Button>
                            </Form>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
