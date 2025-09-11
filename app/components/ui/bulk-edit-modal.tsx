import React, { useState } from 'react';
import { Form } from 'react-router';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { SearchableSelect } from './searchable-select';

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedIds: string[];
  isSubmitting?: boolean;
  title?: string;
  dataPoints?: any;
}

export function BulkEditModal({
  isOpen,
  onClose,
  selectedIds,
  isSubmitting = false,
  title = "Bulk Edit Shipment Plans",
  dataPoints
}: BulkEditModalProps) {
  const [formData, setFormData] = useState({
    bulk_business_branch: '',
    bulk_shipment_type: '',
    bulk_loading_port: '',
    bulk_destination_country: '',
    bulk_port_of_discharge: '',
    bulk_customer: '',
    bulk_consignee: '',
    bulk_selling_price: '',
    bulk_buying_price: '',
    bulk_carrier: '',
    bulk_vessel: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = () => {
    // The form will be submitted via Form component
    onClose();
  };

  const handleReset = () => {
    setFormData({
      bulk_business_branch: '',
      bulk_shipment_type: '',
      bulk_loading_port: '',
      bulk_destination_country: '',
      bulk_port_of_discharge: '',
      bulk_customer: '',
      bulk_consignee: '',
      bulk_selling_price: '',
      bulk_buying_price: '',
      bulk_carrier: '',
      bulk_vessel: ''
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 text-sm">✏️</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-500">
                  Update {selectedIds.length} selected shipment plan{selectedIds.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-semibold transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <Form method="post" className="flex flex-col h-full">
          <input type="hidden" name="action" value="bulkEdit" />
          {selectedIds.map(id => (
            <input key={id} type="hidden" name="selectedIds" value={id} />
          ))}
          
          <div className="px-6 py-4 overflow-y-auto flex-1" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <span className="font-medium">Note:</span> Only fill in the fields you want to update. 
                Empty fields will be left unchanged across all selected shipment plans.
              </p>
            </div>

            {/* Section 1: Basic Information */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
              <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-2">📋 Basic Information</h4>
              
              {/* Business Branch */}
              <div className="space-y-2">
                <Label htmlFor="bulk_business_branch">Business Branch</Label>
                {dataPoints?.businessBranches ? (
                  <SearchableSelect
                    id="bulk_business_branch"
                    name="bulk_business_branch"
                    value={formData.bulk_business_branch}
                    options={dataPoints.businessBranches.map((branch: any) => ({
                      value: branch.name,
                      label: `🏢 ${branch.name} (${branch.code})`
                    }))}
                    placeholder="Select business branch (leave empty to keep current)"
                    onChange={(value) => handleInputChange('bulk_business_branch', value)}
                    className="w-full"
                  />
                ) : (
                  <Input
                    id="bulk_business_branch"
                    name="bulk_business_branch"
                    placeholder="Enter business branch (leave empty to keep current)"
                    value={formData.bulk_business_branch}
                    onChange={(e) => handleInputChange('bulk_business_branch', e.target.value)}
                    className="w-full"
                  />
                )}
              </div>

              {/* Shipment Type */}
              <div className="space-y-2">
                <Label htmlFor="bulk_shipment_type">Shipment Type</Label>
                <select
                  id="bulk_shipment_type"
                  name="bulk_shipment_type"
                  value={formData.bulk_shipment_type}
                  onChange={(e) => handleInputChange('bulk_shipment_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Keep current shipment type</option>
                  <option value="Direct">📋 Direct</option>
                  <option value="Consolidation">📦 Consolidation</option>
                </select>
              </div>
            </div>

            {/* Section 2: Ports & Locations */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
              <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-2">🌍 Ports & Locations</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Loading Port */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_loading_port">Loading Port</Label>
                  {dataPoints?.loadingPorts ? (
                    <SearchableSelect
                      id="bulk_loading_port"
                      name="bulk_loading_port"
                      value={formData.bulk_loading_port}
                      options={dataPoints.loadingPorts.map((port: any) => ({
                        value: port.name,
                        label: `🚢 ${port.name}, ${port.country}`
                      }))}
                      placeholder="Select loading port"
                      onChange={(value) => handleInputChange('bulk_loading_port', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_loading_port"
                      name="bulk_loading_port"
                      placeholder="Enter loading port"
                      value={formData.bulk_loading_port}
                      onChange={(e) => handleInputChange('bulk_loading_port', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Port of Discharge */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_port_of_discharge">Port of Discharge</Label>
                  {dataPoints?.portsOfDischarge ? (
                    <SearchableSelect
                      id="bulk_port_of_discharge"
                      name="bulk_port_of_discharge"
                      value={formData.bulk_port_of_discharge}
                      options={dataPoints.portsOfDischarge.map((port: any) => ({
                        value: port.name,
                        label: `🏢 ${port.name}, ${port.country}`
                      }))}
                      placeholder="Select port of discharge"
                      onChange={(value) => handleInputChange('bulk_port_of_discharge', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_port_of_discharge"
                      name="bulk_port_of_discharge"
                      placeholder="Enter port of discharge"
                      value={formData.bulk_port_of_discharge}
                      onChange={(e) => handleInputChange('bulk_port_of_discharge', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Destination Country */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_destination_country">Destination Country</Label>
                  {dataPoints?.destinationCountries ? (
                    <SearchableSelect
                      id="bulk_destination_country"
                      name="bulk_destination_country"
                      value={formData.bulk_destination_country}
                      options={dataPoints.destinationCountries.map((country: any) => ({
                        value: country.name,
                        label: `🌍 ${country.name}`
                      }))}
                      placeholder="Select destination country"
                      onChange={(value) => handleInputChange('bulk_destination_country', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_destination_country"
                      name="bulk_destination_country"
                      placeholder="Enter destination country"
                      value={formData.bulk_destination_country}
                      onChange={(e) => handleInputChange('bulk_destination_country', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 3: Parties */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
              <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-2">👥 Parties</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Customer */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_customer">Customer</Label>
                  {dataPoints?.organizations ? (
                    <SearchableSelect
                      id="bulk_customer"
                      name="bulk_customer"
                      value={formData.bulk_customer}
                      options={dataPoints.organizations
                        .filter((org: any) => org.orgTypes.includes("Customer"))
                        .map((org: any) => ({
                          value: org.name,
                          label: `🏢 ${org.name} (${org.orgTypes.join(", ")})`
                        }))}
                      placeholder="Select customer"
                      onChange={(value) => handleInputChange('bulk_customer', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_customer"
                      name="bulk_customer"
                      placeholder="Enter customer"
                      value={formData.bulk_customer}
                      onChange={(e) => handleInputChange('bulk_customer', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Consignee */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_consignee">Consignee</Label>
                  {dataPoints?.organizations ? (
                    <SearchableSelect
                      id="bulk_consignee"
                      name="bulk_consignee"
                      value={formData.bulk_consignee}
                      options={dataPoints.organizations
                        .filter((org: any) => org.orgTypes.includes("Consignee"))
                        .map((org: any) => ({
                          value: org.name,
                          label: `🏢 ${org.name} (${org.orgTypes.join(", ")})`
                        }))}
                      placeholder="Select consignee"
                      onChange={(value) => handleInputChange('bulk_consignee', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_consignee"
                      name="bulk_consignee"
                      placeholder="Enter consignee"
                      value={formData.bulk_consignee}
                      onChange={(e) => handleInputChange('bulk_consignee', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Logistics */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 mb-4">
              <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-2">🚢 Logistics</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Carrier */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_carrier">Carrier</Label>
                  {dataPoints?.carriers ? (
                    <SearchableSelect
                      id="bulk_carrier"
                      name="bulk_carrier"
                      value={formData.bulk_carrier}
                      options={dataPoints.carriers.map((carrier: any) => ({
                        value: carrier.name,
                        label: `🚛 ${carrier.name}`
                      }))}
                      placeholder="Select carrier"
                      onChange={(value) => handleInputChange('bulk_carrier', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_carrier"
                      name="bulk_carrier"
                      placeholder="Enter carrier"
                      value={formData.bulk_carrier}
                      onChange={(e) => handleInputChange('bulk_carrier', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>

                {/* Vessel */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_vessel">Vessel</Label>
                  {dataPoints?.vessels ? (
                    <SearchableSelect
                      id="bulk_vessel"
                      name="bulk_vessel"
                      value={formData.bulk_vessel}
                      options={dataPoints.vessels.map((vessel: any) => ({
                        value: vessel.name,
                        label: `🚢 ${vessel.name}`
                      }))}
                      placeholder="Select vessel"
                      onChange={(value) => handleInputChange('bulk_vessel', value)}
                      className="w-full"
                    />
                  ) : (
                    <Input
                      id="bulk_vessel"
                      name="bulk_vessel"
                      placeholder="Enter vessel"
                      value={formData.bulk_vessel}
                      onChange={(e) => handleInputChange('bulk_vessel', e.target.value)}
                      className="w-full"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Section 5: Pricing */}
            <div className="border border-gray-200 rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-900 text-sm border-b border-gray-200 pb-2">💰 Pricing</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Selling Price */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_selling_price">Selling Price</Label>
                  <Input
                    id="bulk_selling_price"
                    name="bulk_selling_price"
                    type="number"
                    step="0.01"
                    placeholder="Enter selling price"
                    value={formData.bulk_selling_price}
                    onChange={(e) => handleInputChange('bulk_selling_price', e.target.value)}
                    className="w-full"
                  />
                </div>

                {/* Buying Price */}
                <div className="space-y-2">
                  <Label htmlFor="bulk_buying_price">Buying Price</Label>
                  <Input
                    id="bulk_buying_price"
                    name="bulk_buying_price"
                    type="number"
                    step="0.01"
                    placeholder="Enter buying price"
                    value={formData.bulk_buying_price}
                    onChange={(e) => handleInputChange('bulk_buying_price', e.target.value)}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="px-4 py-2"
            >
              Reset Form
            </Button>
            
            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-6 py-2"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
              >
                {isSubmitting ? "Updating..." : `Update ${selectedIds.length} Plan${selectedIds.length > 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        </Form>
      </div>
    </div>
  );
}
