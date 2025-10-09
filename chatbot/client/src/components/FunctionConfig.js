import React, { useState } from 'react';
import { Plus, Trash2, Settings, Key, Calendar, Zap } from 'lucide-react';
import CustomFunctionModal from './CustomFunctionModal';
import FixedFunctionModal from './FixedFunctionModal';

const FunctionConfig = ({ 
  functions, 
  onFunctionsChange, 
  openaiApiKey, 
  onOpenaiApiKeyChange,
  calComApiKey,
  onCalComApiKeyChange,
  calComEventId,
  onCalComEventIdChange
}) => {
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showFixedModal, setShowFixedModal] = useState(false);
  const [editingFunction, setEditingFunction] = useState(null);

  const handleAddCustomFunction = (functionData) => {
    const newFunction = {
      id: Date.now().toString(),
      type: 'custom',
      ...functionData
    };
    onFunctionsChange([...functions, newFunction]);
  };

  const handleAddFixedFunction = (functionData) => {
    const newFunction = {
      id: Date.now().toString(),
      type: 'fixed',
      ...functionData
    };
    onFunctionsChange([...functions, newFunction]);
  };

  const handleEditFunction = (func) => {
    setEditingFunction(func);
    if (func.type === 'custom') {
      setShowCustomModal(true);
    } else {
      setShowFixedModal(true);
    }
  };

  const handleUpdateFunction = (updatedFunction) => {
    const updatedFunctions = functions.map(f => 
      f.id === editingFunction.id ? { ...updatedFunction, id: editingFunction.id } : f
    );
    onFunctionsChange(updatedFunctions);
    setEditingFunction(null);
  };

  const handleDeleteFunction = (functionId) => {
    onFunctionsChange(functions.filter(f => f.id !== functionId));
  };

  const getFunctionIcon = (type) => {
    switch (type) {
      case 'custom':
        return <Zap className="h-4 w-4" />;
      case 'fixed':
        return <Settings className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getFunctionTypeColor = (type) => {
    switch (type) {
      case 'custom':
        return 'bg-purple-100 text-purple-800';
      case 'fixed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* API Configuration */}
      <div className="space-y-4">
        <h3 className="text-md font-semibold text-gray-900 flex items-center">
          <Key className="h-5 w-5 mr-2" />
          API Configuration
        </h3>
        
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => onOpenaiApiKeyChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="sk-..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cal.com API Key
            </label>
            <input
              type="password"
              value={calComApiKey}
              onChange={(e) => onCalComApiKeyChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="cal_..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cal.com Event ID
            </label>
            <input
              type="text"
              value={calComEventId}
              onChange={(e) => onCalComEventIdChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="event-id"
            />
          </div>
        </div>
      </div>

      {/* Functions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-md font-semibold text-gray-900 flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Functions
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCustomModal(true)}
              className="flex items-center px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Custom
            </button>
            <button
              onClick={() => setShowFixedModal(true)}
              className="flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-1" />
              Fixed
            </button>
          </div>
        </div>

        {/* Functions List */}
        <div className="space-y-3">
          {/* Show available functions based on configuration */}
          {calComApiKey && calComEventId && (
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium text-gray-700 flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Cal.com Functions (Auto-enabled)
              </h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>check_availability_cal - Check calendar availability</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>book_appointment_cal - Book appointments</span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 bg-blue-50 p-2 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>get_slots_cal - Get available time slots</span>
                </div>
              </div>
            </div>
          )}
          
          {functions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No custom functions configured yet</p>
              <p className="text-sm">Add custom or fixed functions to extend agent capabilities</p>
            </div>
          ) : (
            functions.map((func) => (
              <div key={func.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-md ${getFunctionTypeColor(func.type)}`}>
                      {getFunctionIcon(func.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{func.name}</h4>
                      <p className="text-sm text-gray-600">{func.description}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getFunctionTypeColor(func.type)}`}>
                        {func.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleEditFunction(func)}
                      className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteFunction(func.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <CustomFunctionModal
        isOpen={showCustomModal}
        onClose={() => {
          setShowCustomModal(false);
          setEditingFunction(null);
        }}
        onSave={editingFunction ? handleUpdateFunction : handleAddCustomFunction}
        functionData={editingFunction}
      />

      <FixedFunctionModal
        isOpen={showFixedModal}
        onClose={() => {
          setShowFixedModal(false);
          setEditingFunction(null);
        }}
        onSave={editingFunction ? handleUpdateFunction : handleAddFixedFunction}
        functionData={editingFunction}
        calComApiKey={calComApiKey}
        calComEventId={calComEventId}
      />
    </div>
  );
};

export default FunctionConfig;
