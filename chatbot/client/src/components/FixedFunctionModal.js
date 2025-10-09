import React, { useState, useEffect } from 'react';
import { X, Settings, Calendar, CheckCircle, XCircle } from 'lucide-react';

const FixedFunctionModal = ({ isOpen, onClose, onSave, functionData, calComApiKey, calComEventId }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    functionType: 'end_conversation',
    speakDuringExecution: false,
    speakAfterExecution: true,
    responseVariables: []
  });

  const fixedFunctionTypes = [
    {
      id: 'end_conversation',
      name: 'End Conversation',
      description: 'End the current conversation gracefully',
      icon: <XCircle className="h-5 w-5" />
    },
    {
      id: 'check_availability',
      name: 'Check Availability',
      description: 'Check calendar availability for a given date and time',
      icon: <Calendar className="h-5 w-5" />
    },
    {
      id: 'book_appointment',
      name: 'Book Appointment',
      description: 'Book an appointment using Cal.com integration',
      icon: <CheckCircle className="h-5 w-5" />
    }
  ];

  useEffect(() => {
    if (functionData) {
      setFormData({
        name: functionData.name || '',
        description: functionData.description || '',
        functionType: functionData.functionType || 'end_conversation',
        speakDuringExecution: functionData.speakDuringExecution || false,
        speakAfterExecution: functionData.speakAfterExecution !== false,
        responseVariables: functionData.responseVariables || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        functionType: 'end_conversation',
        speakDuringExecution: false,
        speakAfterExecution: true,
        responseVariables: []
      });
    }
  }, [functionData, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddResponseVariable = () => {
    setFormData(prev => ({
      ...prev,
      responseVariables: [...prev.responseVariables, { key: '', value: '' }]
    }));
  };

  const handleResponseVariableChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      responseVariables: prev.responseVariables.map((item, i) => 
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleRemoveResponseVariable = (index) => {
    setFormData(prev => ({
      ...prev,
      responseVariables: prev.responseVariables.filter((_, i) => i !== index)
    }));
  };

  const getDefaultName = (functionType) => {
    const type = fixedFunctionTypes.find(t => t.id === functionType);
    return type ? type.name.toLowerCase().replace(/\s+/g, '_') : '';
  };

  const getDefaultDescription = (functionType) => {
    const type = fixedFunctionTypes.find(t => t.id === functionType);
    return type ? type.description : '';
  };

  const handleFunctionTypeChange = (functionType) => {
    setFormData(prev => ({
      ...prev,
      functionType,
      name: prev.name || getDefaultName(functionType),
      description: prev.description || getDefaultDescription(functionType)
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a function name');
      return;
    }

    if (!formData.functionType) {
      alert('Please select a function type');
      return;
    }

    // Validate Cal.com requirements for booking functions
    if (formData.functionType === 'book_appointment' && (!calComApiKey || !calComEventId)) {
      alert('Cal.com API Key and Event ID are required for booking appointments');
      return;
    }

    onSave(formData);
    onClose();
  };

  const selectedFunctionType = fixedFunctionTypes.find(t => t.id === formData.functionType);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Settings className="h-6 w-6 text-blue-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {functionData ? 'Edit Fixed Function' : 'Add Fixed Function'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-6">
            {/* Function Type Selection */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Function Type *
              </label>
              <div className="grid grid-cols-1 gap-3">
                {fixedFunctionTypes.map((type) => (
                  <div
                    key={type.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      formData.functionType === type.id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleFunctionTypeChange(type.id)}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-md ${
                        formData.functionType === type.id
                          ? 'bg-primary-100 text-primary-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {type.icon}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{type.name}</h4>
                        <p className="text-sm text-gray-600">{type.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Function Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="e.g., check_availability_cal"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  rows="3"
                  placeholder="Describe what this function does..."
                />
              </div>
            </div>

            {/* Function-specific Configuration */}
            {formData.functionType === 'book_appointment' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Cal.com Integration</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <div>• API Key: {calComApiKey ? '✓ Configured' : '✗ Missing'}</div>
                  <div>• Event ID: {calComEventId ? '✓ Configured' : '✗ Missing'}</div>
                  {(!calComApiKey || !calComEventId) && (
                    <div className="text-blue-600 mt-2">
                      Please configure Cal.com settings in the main configuration panel.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Response Variables */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Response Variables
                </label>
                <button
                  onClick={handleAddResponseVariable}
                  className="flex items-center px-3 py-1 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                >
                  <span className="mr-1">+</span>
                  Add Variable
                </button>
              </div>
              
              <div className="space-y-3">
                {formData.responseVariables.map((variable, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <input
                      type="text"
                      value={variable.key}
                      onChange={(e) => handleResponseVariableChange(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Variable name"
                    />
                    <input
                      type="text"
                      value={variable.value}
                      onChange={(e) => handleResponseVariableChange(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="JSON path (e.g., $.data.id)"
                    />
                    <button
                      onClick={() => handleRemoveResponseVariable(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Execution Options */}
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Execution Options
              </label>
              
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.speakDuringExecution}
                    onChange={(e) => handleInputChange('speakDuringExecution', e.target.checked)}
                    className="mr-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Speak During Execution</div>
                    <div className="text-xs text-gray-500">If the function takes over 2 seconds, the agent can say something like: 'Let me check that for you.'</div>
                  </div>
                </label>
                
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.speakAfterExecution}
                    onChange={(e) => handleInputChange('speakAfterExecution', e.target.checked)}
                    className="mr-3 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-gray-700">Speak After Execution</div>
                    <div className="text-xs text-gray-500">Unselect if you want to run the function silently, such as uploading the call result to the server silently.</div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            {functionData ? 'Update' : 'Save'} Function
          </button>
        </div>
      </div>
    </div>
  );
};

export default FixedFunctionModal;
