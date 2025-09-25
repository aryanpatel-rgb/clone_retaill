import { Link, useLocation } from 'react-router-dom';
import {
    Bot,
    BarChart3,
    MessageSquare,
    Settings,
    HelpCircle,
    X,
    Zap,
    Users,
    Phone
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
    const location = useLocation();

    const navigation = [
        { name: 'Agents', href: '/', icon: Bot, current: location.pathname === '/' },
        { name: 'Analytics', href: '/analytics', icon: BarChart3, current: location.pathname === '/analytics' },
        { name: 'Sessions', href: '/sessions', icon: MessageSquare, current: location.pathname === '/sessions' },
        { name: 'Calls', href: '/calls', icon: Phone, current: location.pathname === '/calls' },
        { name: 'Integrations', href: '/integrations', icon: Zap, current: location.pathname === '/integrations' },
        { name: 'Team', href: '/team', icon: Users, current: location.pathname === '/team' },
        { name: 'Settings', href: '/settings', icon: Settings, current: location.pathname === '/settings' },
    ];

    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar */}
            <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
                <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                                <Bot className="w-5 h-5 text-white" />
                            </div>
                        </div>
                        <div className="ml-3">
                            <h1 className="text-xl font-bold text-gray-900">Retell AI</h1>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <nav className="mt-8 px-4">
                    <ul className="space-y-2">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            return (
                                <li key={item.name}>
                                    <Link
                                        to={item.href}
                                        className={`
                      group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200
                      ${item.current
                                                ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                                                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                                            }
                    `}
                                    >
                                        <Icon className={`
                      mr-3 h-5 w-5 flex-shrink-0
                      ${item.current ? 'text-blue-700' : 'text-gray-400 group-hover:text-gray-500'}
                    `} />
                                        {item.name}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>

                {/* Help section */}
                <div className="absolute bottom-0 w-full p-4 border-t border-gray-200">
                    <Link
                        to="/help"
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 hover:text-gray-900"
                    >
                        <HelpCircle className="mr-3 h-5 w-5 text-gray-400" />
                        Help & Support
                    </Link>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
