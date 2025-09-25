// Performance monitoring utilities

export const measurePerformance = (name, fn) => {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`${name} took ${end - start} milliseconds`);
    }
    
    return result;
};

export const measureAsyncPerformance = async (name, fn) => {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    
    if (process.env.NODE_ENV === 'development') {
        console.log(`${name} took ${end - start} milliseconds`);
    }
    
    return result;
};

// Memory usage monitoring
export const logMemoryUsage = (label = 'Memory Usage') => {
    if (process.env.NODE_ENV === 'development' && performance.memory) {
        const memory = performance.memory;
        console.log(`${label}:`, {
            used: `${Math.round(memory.usedJSHeapSize / 1048576)} MB`,
            total: `${Math.round(memory.totalJSHeapSize / 1048576)} MB`,
            limit: `${Math.round(memory.jsHeapSizeLimit / 1048576)} MB`
        });
    }
};
