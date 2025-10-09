import React, { useState, useEffect } from 'react';
import { X, Zap, Code, Eye, EyeOff } from 'lucide-react';

const CustomFunctionModal = ({ isOpen, onClose, onSave, functionData }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: '',
    speakDuringExecution: false,
    speakAfterExecution: true,
    responseVariables: []
  });
  const [showSchema, setShowSchema] = useState(true);
  const [schemaError, setSchemaError] = useState('');

  useEffect(() => {
    if (functionData) {
      setFormData({
        name: functionData.name || '',
        description: functionData.description || '',
        schema: functionData.schema || '',
        speakDuringExecution: functionData.speakDuringExecution || false,
        speakAfterExecution: functionData.speakAfterExecution !== false,
        responseVariables: functionData.responseVariables || []
      });
    } else {
      setFormData({
        name: '',
        description: '',
        schema: '',
        speakDuringExecution: false,
        speakAfterExecution: true,
        responseVariables: []
      });
    }
  }, [functionData, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'schema') {
      setSchemaError('');
    }
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

  const validateSchema = (schema) => {
    try {
      if (schema.trim()) {
        JSON.parse(schema);
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  const formatSchema = () => {
    try {
      const parsed = JSON.parse(formData.schema);
      setFormData(prev => ({ ...prev, schema: JSON.stringify(parsed, null, 2) }));
      setSchemaError('');
    } catch (e) {
      setSchemaError('Invalid JSON format');
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a function name');
      return;
    }

    if (formData.schema.trim() && !validateSchema(formData.schema)) {
      setSchemaError('Invalid JSON format');
      return;
    }

    onSave(formData);
    onClose();
  };

  const exampleSchemas = [
    {
      name: 'API Caller',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'HTTP method for the API call'
          },
          url: {
            type: 'string',
            description: 'Full API URL'
          },
          headers: {
            type: 'object',
            description: 'HTTP headers (optional)'
          },
          queryParams: {
            type: 'object',
            description: 'Query parameters (optional)'
          },
          body: {
            type: 'object',
            description: 'Request body (for POST/PUT only)'
          }
        },
        required: ['method', 'url']
      }, null, 2)
    },
    {
      name: 'User Info',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'User name'
          },
          email: {
            type: 'string',
            format: 'email',
            description: 'User email address'
          },
          phone: {
            type: 'string',
            description: 'User phone number'
          }
        },
        required: ['name', 'email']
      }, null, 2)
    },
    {
      name: 'Booking Request',
      schema: JSON.stringify({
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Service to book'
          },
          date: {
            type: 'string',
            format: 'date',
            description: 'Preferred date'
          },
          time: {
            type: 'string',
            description: 'Preferred time'
          },
          duration: {
            type: 'number',
            description: 'Duration in minutes'
          }
        },
        required: ['service', 'date', 'time']
      }, null, 2)
    }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <Zap className="h-6 w-6 text-purple-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">
              {functionData ? 'Edit Custom Function' : 'Add Custom Function'}
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
                  placeholder="e.g., custom_api_call"
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

            {/* JSON Schema */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Parameters (JSON Schema)
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowSchema(!showSchema)}
                    className="flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                  >
                    {showSchema ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                    {showSchema ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={formatSchema}
                    className="flex items-center px-2 py-1 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Format JSON
                  </button>
                </div>
              </div>
              
              {showSchema && (
                <div className="space-y-3">
                  <textarea
                    value={formData.schema}
                    onChange={(e) => handleInputChange('schema', e.target.value)}
                    className="w-full h-48 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter JSON Schema here..."
                  />
                  {schemaError && (
                    <p className="text-sm text-red-600">{schemaError}</p>
                  )}
                  
                  {/* Example Schemas */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Examples:</p>
                    <div className="flex flex-wrap gap-2">
                      {exampleSchemas.map((example, index) => (
                        <button
                          key={index}
                          onClick={() => handleInputChange('schema', example.schema)}
                          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                          {example.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

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

export default CustomFunctionModal;
