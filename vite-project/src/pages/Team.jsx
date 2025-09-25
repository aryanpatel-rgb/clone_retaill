import { useState, useEffect } from 'react';
import { Plus, UserPlus, Mail, Phone, Shield, MoreVertical, Edit, Trash2, Crown, User, Users, CheckCircle, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

const Team = () => {
    const { user } = useApp();
    const [teamMembers, setTeamMembers] = useState([]);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteForm, setInviteForm] = useState({
        email: '',
        name: '',
        role: 'member'
    });
    const [isLoading, setIsLoading] = useState(false);

    // Sample team data
    const sampleTeamMembers = [
        {
            id: '1',
            name: 'John Smith',
            email: 'john@company.com',
            role: 'admin',
            status: 'active',
            joinedAt: new Date('2024-01-15'),
            lastActive: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            avatar: null,
            permissions: ['manage_agents', 'view_analytics', 'manage_team', 'manage_billing']
        },
        {
            id: '2',
            name: 'Sarah Johnson',
            email: 'sarah@company.com',
            role: 'manager',
            status: 'active',
            joinedAt: new Date('2024-02-01'),
            lastActive: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
            avatar: null,
            permissions: ['manage_agents', 'view_analytics', 'view_team']
        },
        {
            id: '3',
            name: 'Mike Wilson',
            email: 'mike@company.com',
            role: 'member',
            status: 'active',
            joinedAt: new Date('2024-02-15'),
            lastActive: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
            avatar: null,
            permissions: ['view_agents', 'view_analytics']
        },
        {
            id: '4',
            name: 'Emily Davis',
            email: 'emily@company.com',
            role: 'member',
            status: 'pending',
            joinedAt: null,
            lastActive: null,
            avatar: null,
            permissions: ['view_agents']
        }
    ];

    useEffect(() => {
        setTeamMembers(sampleTeamMembers);
    }, []);

    const roles = [
        { value: 'admin', label: 'Admin', description: 'Full access to all features', color: 'bg-red-100 text-red-800' },
        { value: 'manager', label: 'Manager', description: 'Manage agents and view analytics', color: 'bg-blue-100 text-blue-800' },
        { value: 'member', label: 'Member', description: 'View agents and basic analytics', color: 'bg-green-100 text-green-800' },
        { value: 'viewer', label: 'Viewer', description: 'Read-only access', color: 'bg-gray-100 text-gray-800' }
    ];

    const getRoleInfo = (role) => {
        return roles.find(r => r.value === role) || roles[3];
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active': return 'text-green-600 bg-green-100';
            case 'pending': return 'text-yellow-600 bg-yellow-100';
            case 'inactive': return 'text-gray-600 bg-gray-100';
            case 'suspended': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const formatDate = (date) => {
        if (!date) return 'N/A';
        return date.toLocaleDateString();
    };

    const formatLastActive = (date) => {
        if (!date) return 'Never';
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ago`;
        } else if (minutes > 0) {
            return `${minutes}m ago`;
        } else {
            return 'Just now';
        }
    };

    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const newMember = {
                id: Date.now().toString(),
                name: inviteForm.name,
                email: inviteForm.email,
                role: inviteForm.role,
                status: 'pending',
                joinedAt: null,
                lastActive: null,
                avatar: null,
                permissions: getRoleInfo(inviteForm.role).permissions || []
            };

            setTeamMembers(prev => [...prev, newMember]);
            setInviteForm({ email: '', name: '', role: 'member' });
            setShowInviteModal(false);
        } catch (error) {
            console.error('Error inviting member:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRemoveMember = (memberId) => {
        if (window.confirm('Are you sure you want to remove this team member?')) {
            setTeamMembers(prev => prev.filter(member => member.id !== memberId));
        }
    };

    const handleRoleChange = (memberId, newRole) => {
        setTeamMembers(prev => prev.map(member => 
            member.id === memberId 
                ? { ...member, role: newRole, permissions: getRoleInfo(newRole).permissions || [] }
                : member
        ));
    };

    const InviteModal = () => (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div className="mt-3">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900">Invite Team Member</h3>
                        <button
                            onClick={() => setShowInviteModal(false)}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <XCircle className="w-6 h-6" />
                        </button>
                    </div>

                    <form onSubmit={handleInviteSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                                Full Name
                            </label>
                            <input
                                type="text"
                                id="name"
                                value={inviteForm.name}
                                onChange={(e) => setInviteForm(prev => ({ ...prev, name: e.target.value }))}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                Email Address
                            </label>
                            <input
                                type="email"
                                id="email"
                                value={inviteForm.email}
                                onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                                Role
                            </label>
                            <select
                                id="role"
                                value={inviteForm.role}
                                onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                                {roles.map(role => (
                                    <option key={role.value} value={role.value}>
                                        {role.label} - {role.description}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="flex justify-end space-x-3 pt-4">
                            <button
                                type="button"
                                onClick={() => setShowInviteModal(false)}
                                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isLoading ? 'Sending...' : 'Send Invite'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
                    <p className="text-gray-600">Manage your team members and their permissions</p>
                </div>
                <button
                    onClick={() => setShowInviteModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
                >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Invite Member
                </button>
            </div>

            {/* Team Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Total Members
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {teamMembers.length}
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
                                <CheckCircle className="h-6 w-6 text-green-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Active Members
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {teamMembers.filter(member => member.status === 'active').length}
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
                                <Crown className="h-6 w-6 text-yellow-600" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">
                                        Admins
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {teamMembers.filter(member => member.role === 'admin').length}
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
                                        Pending Invites
                                    </dt>
                                    <dd className="text-lg font-medium text-gray-900">
                                        {teamMembers.filter(member => member.status === 'pending').length}
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Team Members Table */}
            <div className="bg-white shadow rounded-lg">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900">Team Members</h3>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Member
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Last Active
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teamMembers.map((member) => {
                                const roleInfo = getRoleInfo(member.role);
                                return (
                                    <tr key={member.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                                                        <User className="h-5 w-5 text-gray-600" />
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {member.name}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {member.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${roleInfo.color}`}>
                                                {roleInfo.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(member.status)}`}>
                                                {member.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatDate(member.joinedAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {formatLastActive(member.lastActive)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center space-x-2">
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => handleRoleChange(member.id, e.target.value)}
                                                    className="text-xs border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                                >
                                                    {roles.map(role => (
                                                        <option key={role.value} value={role.value}>
                                                            {role.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleRemoveMember(member.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invite Modal */}
            {showInviteModal && <InviteModal />}
        </div>
    );
};

export default Team;
