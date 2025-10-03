import { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, Edit, Calendar, Phone, MessageSquare, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import CreateFunctionModal from './CreateFunctionModal';
import EditFunctionModal from './EditFunctionModal';

const FunctionManager = ({ agentId, onClose }) => {
    const { getAgentFunctions, createAgentFunction, updateAgentFunction, deleteAgentFunction } = useApp();
    const [functions, setFunctions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingFunction, setEditingFunction] = useState(null);
    const [actionLoading, setActionLoading] = useState({});

    useEffect(() => {
        loadFunctions();
    }, [agentId]);

    const loadFunctions = async () => {
        try {
            setLoading(true);
            const agentFunctions = await getAgentFunctions(agentId);
            // Ensure functions is always an array
            setFunctions(Array.isArray(agentFunctions) ? agentFunctions : []);
        } catch (error) {
            console.error('Error loading functions:', error);
            setFunctions([]); // Set empty array on error
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFunction = async (functionData) => {
        try {
            setActionLoading({ create: true });
            await createAgentFunction(agentId, functionData);
            await loadFunctions();
            setShowCreateModal(false);
        } catch (error) {
            console.error('Error creating function:', error);
        } finally {
            setActionLoading({ create: false });
        }
    };

    const handleUpdateFunction = async (functionId, functionData) => {
        try {
            setActionLoading({ [functionId]: true });
            await updateAgentFunction(functionId, functionData);
            await loadFunctions();
            setEditingFunction(null);
        } catch (error) {
            console.error('Error updating function:', error);
        } finally {
            setActionLoading({ [functionId]: false });
        }
    };

    const handleDeleteFunction = async (functionId) => {
        if (!confirm('Are you sure you want to delete this function?')) return;
        
        try {
            setActionLoading({ [functionId]: true });
            await deleteAgentFunction(functionId);
            await loadFunctions();
        } catch (error) {
            console.error('Error deleting function:', error);
        } finally {
            setActionLoading({ [functionId]: false });
        }
    };

    const getFunctionIcon = (functionType) => {
        switch (functionType) {
            case 'end_call':
                return <Phone className="w-4 h-4" />;
            case 'check_availability':
            case 'book_appointment':
                return <Calendar className="w-4 h-4" />;
            case 'send_sms':
                return <MessageSquare className="w-4 h-4" />;
            default:
                return <Settings className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading functions...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Agent Functions</h3>
                    <p className="text-sm text-gray-600">Manage functions that can be called from your AI prompt</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Function
                </button>
            </div>

            {functions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Settings className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Functions Added</h4>
                    <p className="text-gray-600 mb-4">Add functions to make your agent more powerful</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Add Your First Function
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {functions.map((func) => (
                        <div key={func.id} className="bg-white border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                        {getFunctionIcon(func.function_type)}
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-gray-900">{func.name}</h4>
                                        <p className="text-sm text-gray-600">{func.description}</p>
                                        <span className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded mt-1">
                                            {func.function_type}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => setEditingFunction(func)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteFunction(func.id)}
                                        disabled={actionLoading[func.id]}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                    >
                                        {actionLoading[func.id] ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <CreateFunctionModal
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onSubmit={handleCreateFunction}
                    loading={actionLoading.create}
                />
            )}

            {editingFunction && (
                <EditFunctionModal
                    isOpen={!!editingFunction}
                    onClose={() => setEditingFunction(null)}
                    function={editingFunction}
                    onSubmit={(data) => handleUpdateFunction(editingFunction.id, data)}
                    loading={actionLoading[editingFunction.id]}
                />
            )}
        </div>
    );
};

export default FunctionManager;
