import { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import * as CalComTest from '../test/CalComTest';

const CalComTestRunner = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toISOString() }]);
  };

  const runTest = async (testFunction, testName) => {
    addLog(`Starting ${testName}...`, 'info');
    try {
      const result = await testFunction();
      addLog(`${testName} completed: ${result ? 'SUCCESS' : 'FAILED'}`, result ? 'success' : 'error');
      return result;
    } catch (error) {
      addLog(`${testName} error: ${error.message}`, 'error');
      return false;
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults(null);
    setLogs([]);

    try {
      const results = await CalComTest.runAllTests(addLog);
      
      setResults({
        apiKeyValid: results.apiKeyValidation,
        eventTypeFound: results.eventTypeDetails,
        availabilityChecked: results.availabilityCheck.some(r => r.success),
        appointmentBooked: results.booking,
        functionEngineWorking: results.functionEngine
      });
    } catch (error) {
      addLog(`Test suite error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const runConversationTest = async () => {
    setIsRunning(true);
    setLogs([]);

    try {
      await CalComTest.testConversationFlow(addLog);
    } catch (error) {
      addLog(`Conversation test error: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  };

  const getLogIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning': return <Clock className="w-4 h-4 text-yellow-500" />;
      default: return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogColor = (type) => {
    switch (type) {
      case 'success': return 'text-green-700 bg-green-50';
      case 'error': return 'text-red-700 bg-red-50';
      case 'warning': return 'text-yellow-700 bg-yellow-50';
      default: return 'text-blue-700 bg-blue-50';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Cal.com Integration Test</h2>
          <p className="text-gray-600">
            Test your Cal.com integration with API Key: <code className="bg-gray-100 px-2 py-1 rounded">cal_live_ab4d1bf553fdebc1ff2be9325500a150</code>
          </p>
          <p className="text-gray-600">
            Event ID: <code className="bg-gray-100 px-2 py-1 rounded">3053103</code>
          </p>
        </div>

        <div className="p-6">
          <div className="flex space-x-4 mb-6">
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Run All Tests
            </button>

            <button
              onClick={runConversationTest}
              disabled={isRunning}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Play className="w-4 h-4 mr-2" />
              )}
              Test Conversation Flow
            </button>
          </div>

          {results && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className={`p-3 rounded-lg ${results.apiKeyValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {results.apiKeyValid ? <CheckCircle className="w-5 h-5 text-green-500 mr-2" /> : <XCircle className="w-5 h-5 text-red-500 mr-2" />}
                    <span className="font-medium">API Key</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${results.eventTypeFound ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {results.eventTypeFound ? <CheckCircle className="w-5 h-5 text-green-500 mr-2" /> : <XCircle className="w-5 h-5 text-red-500 mr-2" />}
                    <span className="font-medium">Event Type</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${results.availabilityChecked ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {results.availabilityChecked ? <CheckCircle className="w-5 h-5 text-green-500 mr-2" /> : <XCircle className="w-5 h-5 text-red-500 mr-2" />}
                    <span className="font-medium">Availability</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${results.appointmentBooked ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {results.appointmentBooked ? <CheckCircle className="w-5 h-5 text-green-500 mr-2" /> : <XCircle className="w-5 h-5 text-red-500 mr-2" />}
                    <span className="font-medium">Booking</span>
                  </div>
                </div>

                <div className={`p-3 rounded-lg ${results.functionEngineWorking ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <div className="flex items-center">
                    {results.functionEngineWorking ? <CheckCircle className="w-5 h-5 text-green-500 mr-2" /> : <XCircle className="w-5 h-5 text-red-500 mr-2" />}
                    <span className="font-medium">Functions</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {logs.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Test Logs</h3>
              <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                {logs.map((log, index) => (
                  <div key={index} className={`flex items-start space-x-2 py-2 ${getLogColor(log.type)} rounded px-2 mb-1`}>
                    {getLogIcon(log.type)}
                    <span className="text-sm font-mono">{log.message}</span>
                    <span className="text-xs opacity-60 ml-auto">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalComTestRunner;
