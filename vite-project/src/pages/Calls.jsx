import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, MoreVertical, Play, Pause, Download, Trash2, Calendar, Clock, User, Bot } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Calls = () => {
    const { agents } = useApp();
    const [calls, setCalls] = useState([]);
    const [isInCall, setIsInCall] = useState(false);
    const [currentCall, setCurrentCall] = useState(null);
    const [callStatus, setCallStatus] = useState('idle'); // idle, ringing, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOn, setIsVideoOn] = useState(true);
    const [isSpeakerOn, setIsSpeakerOn] = useState(true);
    const [isRecording, setIsRecording] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [selectedAgent, setSelectedAgent] = useState(null);
    
    // WebRTC refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const callDurationRef = useRef(null);

    // Sample call data
    const sampleCalls = [
        {
            id: '1',
            agentId: 'agent-1',
            agentName: 'Customer Support Agent',
            customerName: 'John Smith',
            customerPhone: '+1 (555) 123-4567',
            status: 'completed',
            duration: 180, // 3 minutes
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            endTime: new Date(Date.now() - 2 * 60 * 60 * 1000 + 180 * 1000),
            recording: 'recording_1.mp3',
            transcript: 'Customer called about billing issue. Resolved by updating payment method.',
            satisfaction: 5
        },
        {
            id: '2',
            agentId: 'agent-2',
            agentName: 'Sales Agent',
            customerName: 'Sarah Johnson',
            customerPhone: '+1 (555) 987-6543',
            status: 'completed',
            duration: 420, // 7 minutes
            startTime: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
            endTime: new Date(Date.now() - 4 * 60 * 60 * 1000 + 420 * 1000),
            recording: 'recording_2.mp3',
            transcript: 'Customer interested in premium plan. Scheduled follow-up call.',
            satisfaction: 4
        },
        {
            id: '3',
            agentId: 'agent-1',
            agentName: 'Customer Support Agent',
            customerName: 'Mike Wilson',
            customerPhone: '+1 (555) 456-7890',
            status: 'in_progress',
            duration: 0,
            startTime: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
            endTime: null,
            recording: null,
            transcript: '',
            satisfaction: null
        }
    ];

    useEffect(() => {
        setCalls(sampleCalls);
    }, []);

    // Call duration timer
    useEffect(() => {
        if (callStatus === 'connected' && isInCall) {
            callDurationRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);
        } else {
            if (callDurationRef.current) {
                clearInterval(callDurationRef.current);
                callDurationRef.current = null;
            }
        }

        return () => {
            if (callDurationRef.current) {
                clearInterval(callDurationRef.current);
            }
        };
    }, [callStatus, isInCall]);

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatDate = (date) => {
        return date.toLocaleDateString();
    };

    const startCall = async (agent) => {
        try {
            setSelectedAgent(agent);
            setCallStatus('ringing');
            setIsInCall(true);
            setCallDuration(0);

            // Get user media
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localStreamRef.current = stream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Simulate call connection after 3 seconds
            setTimeout(() => {
                setCallStatus('connected');
                setCurrentCall({
                    id: Date.now().toString(),
                    agentId: agent.agent_id,
                    agentName: agent.name,
                    customerName: 'You',
                    startTime: new Date(),
                    status: 'connected'
                });
            }, 3000);

        } catch (error) {
            console.error('Error starting call:', error);
            setCallStatus('idle');
            setIsInCall(false);
        }
    };

    const endCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        
        setIsInCall(false);
        setCallStatus('idle');
        setCurrentCall(null);
        setCallDuration(0);
        setIsRecording(false);
        setSelectedAgent(null);
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOn(!videoTrack.enabled);
            }
        }
    };

    const toggleRecording = () => {
        setIsRecording(!isRecording);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100';
            case 'in_progress': return 'text-blue-600 bg-blue-100';
            case 'failed': return 'text-red-600 bg-red-100';
            case 'missed': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getSatisfactionStars = (rating) => {
        if (!rating) return null;
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Calls</h1>
                    <p className="text-gray-600">Manage and monitor your AI agent calls</p>
                </div>
                <div className="flex space-x-3">
                    <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                        <Calendar className="w-4 h-4 mr-2" />
                        Schedule Call
                    </button>
                    <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                        <Phone className="w-4 h-4 mr-2" />
                        Start Call
                    </button>
                </div>
            </div>

            {/* Active Call Interface */}
            {isInCall && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {callStatus === 'ringing' ? 'Calling...' : 'In Call'}
                        </h3>
                        <p className="text-gray-600 mb-4">
                            {selectedAgent?.name || 'Agent'}
                        </p>
                        
                        {callStatus === 'connected' && (
                            <div className="text-2xl font-mono text-blue-600 mb-4">
                                {formatDuration(callDuration)}
                            </div>
                        )}

                        {/* Video Streams */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div className="relative">
                                <video
                                    ref={localVideoRef}
                                    autoPlay
                                    muted
                                    className="w-full h-48 bg-gray-900 rounded-lg"
                                />
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                    You
                                </div>
                            </div>
                            <div className="relative">
                                <video
                                    ref={remoteVideoRef}
                                    autoPlay
                                    className="w-full h-48 bg-gray-900 rounded-lg"
                                />
                                <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                                    {selectedAgent?.name || 'Agent'}
                                </div>
                            </div>
                        </div>

                        {/* Call Controls */}
                        <div className="flex justify-center space-x-4">
                            <button
                                onClick={toggleMute}
                                className={`p-3 rounded-full ${
                                    isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
                                } hover:bg-opacity-80`}
                            >
                                {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                            </button>
                            
                            <button
                                onClick={toggleVideo}
                                className={`p-3 rounded-full ${
                                    !isVideoOn ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
                                } hover:bg-opacity-80`}
                            >
                                {!isVideoOn ? <VideoOff className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                            </button>
                            
                            <button
                                onClick={toggleRecording}
                                className={`p-3 rounded-full ${
                                    isRecording ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'
                                } hover:bg-opacity-80`}
                            >
                                {isRecording ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                            </button>
                            
                            <button
                                onClick={endCall}
                                className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600"
                            >
                                <PhoneOff className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Call History */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Call History</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Agent
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Customer
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Duration
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Date & Time
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Satisfaction
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {calls.map((call) => (
                                <tr key={call.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8">
                                                <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <Bot className="h-4 w-4 text-blue-600" />
                                                </div>
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {call.agentName}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8">
                                                <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-gray-600" />
                                                </div>
                                            </div>
                                            <div className="ml-3">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {call.customerName}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {call.customerPhone}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(call.status)}`}>
                                            {call.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatDuration(call.duration)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div>{formatDate(call.startTime)}</div>
                                        <div className="text-gray-500">{formatTime(call.startTime)}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {call.satisfaction ? (
                                            <div className="flex items-center">
                                                <span className="text-yellow-400 mr-1">
                                                    {getSatisfactionStars(call.satisfaction)}
                                                </span>
                                                <span className="text-gray-500">({call.satisfaction}/5)</span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex items-center space-x-2">
                                            {call.recording && (
                                                <button className="text-blue-600 hover:text-blue-900">
                                                    <Play className="w-4 h-4" />
                                                </button>
                                            )}
                                            {call.recording && (
                                                <button className="text-green-600 hover:text-green-900">
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            )}
                                            <button className="text-gray-400 hover:text-gray-600">
                                                <MoreVertical className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Call Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Phone className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Total Calls
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {calls.length}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Clock className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Avg Duration
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {formatDuration(Math.round(calls.reduce((sum, call) => sum + call.duration, 0) / calls.length))}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Volume2 className="h-6 w-6 text-yellow-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Recordings
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {calls.filter(call => call.recording).length}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <User className="h-6 w-6 text-purple-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Avg Rating
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {calls.filter(call => call.satisfaction).length > 0 
                                            ? (calls.filter(call => call.satisfaction).reduce((sum, call) => sum + call.satisfaction, 0) / calls.filter(call => call.satisfaction).length).toFixed(1)
                                            : 'N/A'
                                        }
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Calls;
