import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import api from '../services/api';

const AppContext = createContext();

// Initial state
const initialState = {
    agents: [],
    sessions: [],
    analytics: null,
    loading: {
        agents: false,
        sessions: false,
        analytics: false,
    },
    error: null,
    user: null,
};

// Action types
const ActionTypes = {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    SET_AGENTS: 'SET_AGENTS',
    SET_SESSIONS: 'SET_SESSIONS',
    SET_ANALYTICS: 'SET_ANALYTICS',
    ADD_AGENT: 'ADD_AGENT',
    UPDATE_AGENT: 'UPDATE_AGENT',
    DELETE_AGENT: 'DELETE_AGENT',
    SET_USER: 'SET_USER',
    CLEAR_ERROR: 'CLEAR_ERROR',
    LOGOUT: 'LOGOUT',
};

// Reducer
function appReducer(state, action) {
    switch (action.type) {
        case ActionTypes.SET_LOADING:
            return {
                ...state,
                loading: {
                    ...state.loading,
                    [action.payload.key]: action.payload.value,
                },
            };

        case ActionTypes.SET_ERROR:
            return {
                ...state,
                error: action.payload,
                loading: {
                    agents: false,
                    sessions: false,
                    analytics: false,
                },
            };

        case ActionTypes.CLEAR_ERROR:
            return {
                ...state,
                error: null,
            };

        case ActionTypes.SET_AGENTS:
            return {
                ...state,
                agents: action.payload,
                loading: {
                    ...state.loading,
                    agents: false,
                },
            };

        case ActionTypes.SET_SESSIONS:
            return {
                ...state,
                sessions: action.payload,
                loading: {
                    ...state.loading,
                    sessions: false,
                },
            };

        case ActionTypes.SET_ANALYTICS:
            return {
                ...state,
                analytics: action.payload,
                loading: {
                    ...state.loading,
                    analytics: false,
                },
            };

        case ActionTypes.ADD_AGENT:
            return {
                ...state,
                agents: [action.payload, ...state.agents],
            };

        case ActionTypes.UPDATE_AGENT:
            return {
                ...state,
                agents: state.agents.map(agent =>
                    agent.id === action.payload.id ? action.payload : agent
                ),
            };

        case ActionTypes.DELETE_AGENT:
            return {
                ...state,
                agents: state.agents.filter(agent => agent.id !== action.payload),
            };

        case ActionTypes.SET_USER:
            return {
                ...state,
                user: action.payload,
            };

        case ActionTypes.LOGOUT:
            return {
                ...state,
                user: null,
                agents: [],
                sessions: [],
                analytics: null,
                error: null,
            };

        default:
            return state;
    }
}

// Provider component
export function AppProvider({ children }) {
    const [state, dispatch] = useReducer(appReducer, initialState);

    // Actions
    const actions = {
        setLoading: (key, value) => {
            dispatch({ type: ActionTypes.SET_LOADING, payload: { key, value } });
        },

        setError: (error) => {
            dispatch({ type: ActionTypes.SET_ERROR, payload: error });
        },

        clearError: () => {
            dispatch({ type: ActionTypes.CLEAR_ERROR });
        },

        // Agents
        fetchAgents: useCallback(async () => {
            try {
                dispatch({ type: ActionTypes.SET_LOADING, payload: { key: 'agents', value: true } });
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const agents = await api.getAgents();
                dispatch({ type: ActionTypes.SET_AGENTS, payload: agents });
            } catch (error) {
                console.error('Error fetching agents:', error);
                // Provide fallback data if database is unavailable
                if (error.message.includes('Connection terminated') || error.message.includes('timeout')) {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: 'Database connection unavailable. Please check your connection and try again.' });
                } else {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                }
            }
        }, []),

        createAgent: useCallback(async (agentData) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const newAgent = await api.createAgent(agentData);
                dispatch({ type: ActionTypes.ADD_AGENT, payload: newAgent });
                return newAgent;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        updateAgent: useCallback(async (id, agentData) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const updatedAgent = await api.updateAgent(id, agentData);
                dispatch({ type: ActionTypes.UPDATE_AGENT, payload: updatedAgent });
                return updatedAgent;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        deleteAgent: useCallback(async (id) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                await api.deleteAgent(id);
                dispatch({ type: ActionTypes.DELETE_AGENT, payload: id });
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        // Sessions
        fetchSessions: useCallback(async (params = {}) => {
            try {
                dispatch({ type: ActionTypes.SET_LOADING, payload: { key: 'sessions', value: true } });
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const response = await api.getSessions(params);
                dispatch({ type: ActionTypes.SET_SESSIONS, payload: response.sessions || response });
            } catch (error) {
                console.error('Error fetching sessions:', error);
                if (error.message.includes('Connection terminated') || error.message.includes('timeout')) {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: 'Database connection unavailable. Please check your connection and try again.' });
                } else {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                }
            }
        }, []),

        // Analytics
        fetchAnalytics: useCallback(async (params = {}) => {
            try {
                dispatch({ type: ActionTypes.SET_LOADING, payload: { key: 'analytics', value: true } });
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const analytics = await api.getAnalytics(params);
                dispatch({ type: ActionTypes.SET_ANALYTICS, payload: analytics });
            } catch (error) {
                console.error('Error fetching analytics:', error);
                if (error.message.includes('Connection terminated') || error.message.includes('timeout')) {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: 'Database connection unavailable. Please check your connection and try again.' });
                } else {
                    dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                }
            }
        }, []),

        // User
        setUser: (user) => {
            dispatch({ type: ActionTypes.SET_USER, payload: user });
        },

        // Authentication
        login: useCallback(async (credentials) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const response = await api.login(credentials);
                
                // Store token in localStorage
                localStorage.setItem('token', response.token);
                
                // Set user in context
                dispatch({ type: ActionTypes.SET_USER, payload: response.user });
                
                return response;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        register: useCallback(async (userData) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const response = await api.register(userData);
                
                // Store token in localStorage
                localStorage.setItem('token', response.token);
                
                // Set user in context
                dispatch({ type: ActionTypes.SET_USER, payload: response.user });
                
                return response;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        logout: useCallback(() => {
            // Remove token from localStorage
            localStorage.removeItem('token');
            
            // Clear user from context
            dispatch({ type: ActionTypes.LOGOUT });
        }, []),

        checkAuth: useCallback(async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) {
                    return false;
                }

                const user = await api.getCurrentUser();
                dispatch({ type: ActionTypes.SET_USER, payload: user });
                return true;
            } catch (error) {
                // Token is invalid, remove it
                localStorage.removeItem('token');
                dispatch({ type: ActionTypes.LOGOUT });
                return false;
            }
        }, []),

        updateUser: useCallback(async (userData) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                const updatedUser = await api.updateUser(userData);
                dispatch({ type: ActionTypes.SET_USER, payload: updatedUser });
                return updatedUser;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        changePassword: useCallback(async (passwordData) => {
            try {
                dispatch({ type: ActionTypes.CLEAR_ERROR });
                await api.changePassword(passwordData);
                return true;
            } catch (error) {
                dispatch({ type: ActionTypes.SET_ERROR, payload: error.message });
                throw error;
            }
        }, []),

        // Function management
        getAgentFunctions: useCallback(async (agentId) => {
            try {
                const functions = await api.getAgentFunctions(agentId);
                return functions;
            } catch (error) {
                console.error('Error fetching agent functions:', error);
                throw error;
            }
        }, []),

        createAgentFunction: useCallback(async (agentId, functionData) => {
            try {
                const newFunction = await api.createAgentFunction(agentId, functionData);
                return newFunction;
            } catch (error) {
                console.error('Error creating agent function:', error);
                throw error;
            }
        }, []),

        updateAgentFunction: useCallback(async (functionId, functionData) => {
            try {
                const updatedFunction = await api.updateAgentFunction(functionId, functionData);
                return updatedFunction;
            } catch (error) {
                console.error('Error updating agent function:', error);
                throw error;
            }
        }, []),

        deleteAgentFunction: useCallback(async (functionId) => {
            try {
                await api.deleteAgentFunction(functionId);
            } catch (error) {
                console.error('Error deleting agent function:', error);
                throw error;
            }
        }, []),

        executeFunction: useCallback(async (functionId, params = {}) => {
            try {
                const result = await api.executeFunction(functionId, params);
                return result;
            } catch (error) {
                console.error('Error executing function:', error);
                throw error;
            }
        }, []),

    };

    // Load initial data
    useEffect(() => {
        actions.fetchAgents();
        actions.fetchSessions();
        actions.fetchAnalytics();
    }, [actions.fetchAgents, actions.fetchSessions, actions.fetchAnalytics]);

    const value = useMemo(() => ({
        ...state,
        ...actions,
    }), [state, actions]);

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useApp() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
}
