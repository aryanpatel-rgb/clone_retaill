import { useCallback } from 'react';

export const useErrorHandler = () => {
    const handleError = useCallback((error, context = '') => {
        console.error(`Error in ${context}:`, error);
        
        // You can add more sophisticated error handling here
        // such as sending to error reporting service, showing toast notifications, etc.
        
        return {
            message: error.message || 'An unexpected error occurred',
            code: error.code || 'UNKNOWN_ERROR',
            context
        };
    }, []);

    return { handleError };
};
