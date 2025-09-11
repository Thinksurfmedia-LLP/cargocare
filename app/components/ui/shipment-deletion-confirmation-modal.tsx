import React, { useState } from 'react';
import { Button } from './button';
import { Badge } from './badge';
import { Input } from './input';
import { Label } from './label';

interface LinkedAssignment {
  planId: string;
  referenceNumber: string;
  assignmentId: string;
}

interface ShipmentDeletionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkedAssignments: LinkedAssignment[];
  onConfirm: (choice: 'delete_both' | 'orphan_assignments', reason?: string) => void;
  isSubmitting?: boolean;
}

export function ShipmentDeletionConfirmationModal({
  isOpen,
  onClose,
  linkedAssignments,
  onConfirm,
  isSubmitting = false
}: ShipmentDeletionConfirmationModalProps) {
  const [deletionReason, setDeletionReason] = useState('');
  const [showReasonError, setShowReasonError] = useState(false);

  const handleConfirm = (choice: 'delete_both' | 'orphan_assignments') => {
    if (!deletionReason.trim()) {
      setShowReasonError(true);
      return;
    }
    setShowReasonError(false);
    onConfirm(choice, deletionReason);
  };

  const handleClose = () => {
    setDeletionReason('');
    setShowReasonError(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Linked Shipment Assignments Found
              </h3>
              <p className="text-sm text-gray-600">
                {linkedAssignments.length} shipment plan(s) have active assignments
              </p>
            </div>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p className="text-sm text-gray-700 mb-3">
              The following shipment plans have linked shipment assignments that are currently being used by the liner booking team:
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-h-40 overflow-y-auto">
              <div className="space-y-2">
                {linkedAssignments.map((item) => (
                  <div key={item.planId} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {item.referenceNumber}
                    </span>
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      Assignment Active
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Deletion Reason Input */}
          <div className="mb-6">
            <Label htmlFor="deletionReason" className="block text-sm font-medium text-gray-700 mb-2">
              Reason for deletion *
            </Label>
            <Input
              id="deletionReason"
              type="text"
              placeholder="Please provide a reason for deleting these shipment plans..."
              value={deletionReason}
              onChange={(e) => {
                setDeletionReason(e.target.value);
                if (showReasonError) setShowReasonError(false);
              }}
              className={`w-full ${showReasonError ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : ''}`}
            />
            {showReasonError && (
              <p className="text-red-600 text-sm mt-1">
                Please provide a reason for deletion
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Button 
                onClick={() => handleConfirm('delete_both')}
                disabled={isSubmitting}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-4 text-sm font-medium flex items-center justify-center"
              >
                <span className="mr-2">🗑️</span>
                Delete Plans AND Assignments
              </Button>
              <p className="text-xs text-gray-600 text-center px-2">
                This will permanently remove both shipment plans and their assignments
              </p>
            </div>
            
            <div className="space-y-2">
              <Button 
                onClick={() => handleConfirm('orphan_assignments')}
                disabled={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-4 text-sm font-medium flex items-center justify-center"
              >
                <span className="mr-2">👻</span>
                Delete Plans, Keep Assignments (View-Only)
              </Button>
              <p className="text-xs text-gray-600 text-center px-2">
                Assignments will remain visible but read-only for the liner booking team
              </p>
            </div>
            
            <Button 
              onClick={handleClose}
              disabled={isSubmitting}
              variant="outline" 
              className="w-full py-3 border-gray-300 hover:bg-gray-50 mt-6"
            >
              Cancel Deletion
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}