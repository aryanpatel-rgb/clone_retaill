import { useState, useEffect } from 'react';
import { Calendar, Clock, User, Mail, Phone, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const AppointmentBooking = ({ agentId, customerName, customerPhone, onBookingComplete }) => {
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingStatus, setBookingStatus] = useState(null);
  const [eventTypes, setEventTypes] = useState([]);
  const [selectedEventType, setSelectedEventType] = useState('3053103'); // Default to 30 Min Meeting

  // Load event types on component mount
  useEffect(() => {
    loadEventTypes();
  }, []);

  const loadEventTypes = async () => {
    try {
      const response = await fetch('/api/calcom-bookings/event-types');
      const data = await response.json();
      
      if (data.success) {
        setEventTypes(data.eventTypes);
        if (data.eventTypes.length > 0) {
          setSelectedEventType(data.eventTypes[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading event types:', error);
    }
  };

  const checkAvailability = async (date) => {
    if (!date || !agentId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/calcom-bookings/availability?agentId=${agentId}&date=${date}&eventTypeId=${selectedEventType}`
      );
      const data = await response.json();

      if (data.success) {
        setAvailableSlots(data.slots || []);
      } else {
        console.error('Error checking availability:', data.error);
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error('Error checking availability:', error);
      setAvailableSlots([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const date = e.target.value;
    setSelectedDate(date);
    setSelectedTime('');
    checkAvailability(date);
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !customerEmail) {
      alert('Please fill in all required fields');
      return;
    }

    setIsBooking(true);
    setBookingStatus(null);

    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}`);
      const endTime = new Date(startTime.getTime() + 30 * 60 * 1000); // 30 minutes

      const response = await fetch('/api/calcom-bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          customerName: customerName || 'Customer',
          customerEmail,
          customerPhone: customerPhone || '',
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          eventTypeId: selectedEventType,
          notes: 'Booked via AI call'
        }),
      });

      const data = await response.json();

      if (data.success) {
        setBookingStatus({
          type: 'success',
          message: data.message,
          bookingId: data.bookingId,
          provider: data.provider
        });
        
        if (onBookingComplete) {
          onBookingComplete(data);
        }
      } else {
        setBookingStatus({
          type: 'error',
          message: data.error
        });
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      setBookingStatus({
        type: 'error',
        message: 'Failed to book appointment. Please try again.'
      });
    } finally {
      setIsBooking(false);
    }
  };

  const formatTime = (time) => {
    if (typeof time === 'string' && time.includes('T')) {
      return new Date(time).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }
    return time;
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Book an Appointment</h2>
        <p className="text-gray-600">Schedule your appointment with our AI agent</p>
      </div>

      {bookingStatus && (
        <div className={`mb-6 p-4 rounded-lg ${
          bookingStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center">
            {bookingStatus.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 mr-2" />
            )}
            <p className={`font-medium ${
              bookingStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
            }`}>
              {bookingStatus.message}
            </p>
          </div>
          {bookingStatus.bookingId && (
            <p className="text-sm text-gray-600 mt-1">
              Booking ID: {bookingStatus.bookingId}
            </p>
          )}
        </div>
      )}

      <div className="space-y-6">
        {/* Event Type Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Appointment Type
          </label>
          <select
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {eventTypes.map((eventType) => (
              <option key={eventType.id} value={eventType.id}>
                {eventType.title} ({eventType.length} minutes)
              </option>
            ))}
          </select>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <User className="w-4 h-4 inline mr-1" />
              Customer Name
            </label>
            <input
              type="text"
              value={customerName || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Phone className="w-4 h-4 inline mr-1" />
              Phone Number
            </label>
            <input
              type="text"
              value={customerPhone || ''}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Mail className="w-4 h-4 inline mr-1" />
            Email Address *
          </label>
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            required
          />
        </div>

        {/* Date Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <Calendar className="w-4 h-4 inline mr-1" />
            Select Date
          </label>
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Time Selection */}
        {selectedDate && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Available Times
            </label>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                <span className="text-gray-600">Loading available times...</span>
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => handleTimeSelect(slot.time)}
                    className={`p-3 text-sm rounded-lg border transition-colors ${
                      selectedTime === slot.time
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                    }`}
                  >
                    {formatTime(slot.time)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No available times for this date
              </div>
            )}
          </div>
        )}

        {/* Book Button */}
        <div className="pt-4">
          <button
            onClick={handleBooking}
            disabled={!selectedDate || !selectedTime || !customerEmail || isBooking}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              !selectedDate || !selectedTime || !customerEmail || isBooking
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isBooking ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                Booking Appointment...
              </>
            ) : (
              'Book Appointment'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentBooking;
