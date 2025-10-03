import { useState, useEffect } from 'react';
import { Plus, Phone, Mail, Building, Edit, Trash2, CheckCircle, XCircle, Clock, Search, Filter } from 'lucide-react';
import api from '../services/api';

const Contacts = () => {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [actionLoading, setActionLoading] = useState({});

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    company: '',
    notes: ''
  });

  // Load contacts
  useEffect(() => {
    loadContacts();
  }, [searchTerm]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getContacts({ 
        search: searchTerm || undefined,
        limit: 100 
      });
      setContacts(response.contacts || []);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setActionLoading({ submit: true });
      
      const contactData = {
        name: formData.name,
        phone_number: formData.phone_number,
        company: formData.company || null,
        notes: formData.notes || null
      };

      if (editingContact) {
        await api.updateContact(editingContact.id, contactData);
      } else {
        await api.createContact(contactData);
      }

      setShowAddModal(false);
      setEditingContact(null);
      setFormData({
        name: '',
        phone_number: '',
        email: '',
        company: '',
        notes: '',
        tags: ''
      });
      loadContacts();
    } catch (error) {
      setError(error.message);
    } finally {
      setActionLoading({ submit: false });
    }
  };

  const handleDelete = async (contactId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) {
      return;
    }

    try {
      setActionLoading({ [contactId]: true });
      await api.deleteContact(contactId);
      loadContacts();
    } catch (error) {
      setError(error.message);
    } finally {
      setActionLoading({ [contactId]: false });
    }
  };

  const handleCall = (contact) => {
    // Navigate to calls page with pre-filled contact
    window.location.href = `/calls?contact=${encodeURIComponent(JSON.stringify({
      id: contact.id,
      name: contact.name,
      phone_number: contact.phone_number,
      company: contact.company
    }))}`;
  };

  const handleEdit = (contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone_number: contact.phone_number,
      email: contact.email || '',
      company: contact.company || '',
      notes: contact.notes || '',
      tags: contact.tags ? contact.tags.join(', ') : ''
    });
    setShowAddModal(true);
  };

  const handleVerify = async (contactId) => {
    try {
      setActionLoading({ [`verify-${contactId}`]: true });
      await api.verifyContact(contactId);
      loadContacts();
    } catch (error) {
      setError(error.message);
    } finally {
      setActionLoading({ [`verify-${contactId}`]: false });
    }
  };

  const getVerificationStatus = (contact) => {
    if (contact.is_verified) {
      return { icon: CheckCircle, color: 'text-green-600', text: 'Verified' };
    } else if (contact.verification_status === 'failed') {
      return { icon: XCircle, color: 'text-red-600', text: 'Failed' };
    } else {
      return { icon: Clock, color: 'text-yellow-600', text: 'Pending' };
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone_number.includes(searchTerm) ||
    (contact.email && contact.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600">Manage your contact list for AI calls</p>
        </div>
        <button
          onClick={() => {
            setEditingContact(null);
            setFormData({
              name: '',
              phone_number: '',
              email: '',
              company: '',
              notes: '',
              tags: ''
            });
            setShowAddModal(true);
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Contact
        </button>
      </div>

      {/* Search and Stats */}
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="flex items-center space-x-4 text-sm text-gray-600">
          <span>Total: {contacts.length}</span>
          <span>Verified: {contacts.filter(c => c.is_verified).length}</span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Contacts Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading contacts...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContacts.map((contact) => {
            const verification = getVerificationStatus(contact);
            const VerificationIcon = verification.icon;
            
            return (
              <div key={contact.id} className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Contact Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{contact.name}</h3>
                      <div className="flex items-center mt-1">
                        <VerificationIcon className={`w-4 h-4 mr-1 ${verification.color}`} />
                        <span className={`text-sm ${verification.color}`}>{verification.text}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-1 text-gray-400 hover:text-blue-600"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        disabled={actionLoading[contact.id]}
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <Phone className="w-4 h-4 mr-2" />
                      <span className="font-mono">{formatPhoneNumber(contact.phone_number)}</span>
                    </div>
                    
                    {contact.company && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Building className="w-4 h-4 mr-2" />
                        <span>{contact.company}</span>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {contact.notes && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600 line-clamp-2">{contact.notes}</p>
                    </div>
                  )}

                  {/* Call Button */}
                  <div className="mb-4">
                    <button
                      onClick={() => handleCall(contact)}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                    >
                      <Phone className="w-4 h-4 mr-2" />
                      Call Now
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Called {contact.call_count || 0} times</span>
                    <span>{new Date(contact.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* Verify Button */}
                  {!contact.is_verified && (
                    <div className="mt-4">
                      <button
                        onClick={() => handleVerify(contact.id)}
                        disabled={actionLoading[`verify-${contact.id}`]}
                        className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading[`verify-${contact.id}`] ? 'Verifying...' : 'Verify Number'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredContacts.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Phone className="w-12 h-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm ? 'No contacts match your search.' : 'Get started by adding your first contact.'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Contact
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h2>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="+1 (555) 123-4567"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Include country code (e.g., +1 for US, +91 for India)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Acme Corp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Additional notes about this contact..."
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingContact(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading.submit}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {actionLoading.submit ? 'Saving...' : (editingContact ? 'Update' : 'Add')} Contact
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Contacts;
