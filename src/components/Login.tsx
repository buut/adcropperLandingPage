import React, { useState } from 'react';
import { saveAuth, UserData } from '../utils/auth';

interface LoginProps {
    onLoginSuccess: (user: UserData) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('https://test-platform.adcropper.com/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const result = await response.json();

            if (result.status === 'ok' && result.data) {
                saveAuth(result.data);
                onLoginSuccess(result.data);
            } else {
                setError(result.message || 'Login failed. Please check your credentials.');
            }
        } catch (err) {
            setError('A network error occurred. Please try again.');
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0a1010]/95 backdrop-blur-md overflow-hidden">
            {/* Background Decorative Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>

            <div className="w-full max-w-[420px] p-1 animate-in fade-in zoom-in duration-500">
                <div className="relative bg-white rounded-[32px] shadow-2xl overflow-hidden border border-white/20">
                    {/* Header info */}
                    <div className="pt-10 pb-6 px-10 text-center">
                        <div className="mb-6 inline-flex size-16 bg-primary/10 rounded-2xl items-center justify-center text-primary transform transition-transform hover:scale-110 duration-300">
                            <span className="material-symbols-outlined text-[36px]">layers</span>
                        </div>
                        <h2 className="text-3xl font-bold text-[#121717] tracking-tight mb-2">AdCropper</h2>
                        <p className="text-gray-400 text-sm font-medium">Design Tool Login</p>
                    </div>

                    <form onSubmit={handleLogin} className="px-10 pb-12 space-y-6">
                        <div className="space-y-4">
                            <div className="group">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300 group-focus-within:text-primary transition-colors text-[20px]">
                                        mail
                                    </span>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full h-13 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-2xl text-[14px] font-medium outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                                        placeholder="Enter your email"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="group">
                                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1 transition-colors group-focus-within:text-primary">
                                    Password
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-300 group-focus-within:text-primary transition-colors text-[20px]">
                                        lock
                                    </span>
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full h-13 pl-12 pr-4 bg-gray-50 border border-gray-100 rounded-2xl text-[14px] font-medium outline-none transition-all focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/5"
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                                <span className="material-symbols-outlined text-red-500 text-[20px]">error</span>
                                <p className="text-[12px] font-bold text-red-600 leading-tight">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full h-14 bg-primary hover:bg-[#0f5757] disabled:bg-gray-200 text-white font-bold rounded-2xl shadow-lg shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                        >
                            {isLoading ? (
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <span className="material-symbols-outlined text-[20px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
                                </>
                            )}
                        </button>

                        <div className="pt-2 text-center">
                            <a href="#" className="text-xs font-bold text-gray-400 hover:text-primary transition-colors uppercase tracking-widest">
                                Forgot Password?
                            </a>
                        </div>
                    </form>

                    {/* Footer decoration */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-primary via-blue-500 to-primary/50"></div>
                </div>

                <p className="mt-8 text-center text-white/40 text-[11px] font-medium tracking-wide uppercase">
                    &copy; 2024 AdCropper Design Platform &bull; All Rights Reserved
                </p>
            </div>

            <style>{`
                .h-13 { height: 3.25rem; }
                @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
                @keyframes zoom-in { from { transform: scale(0.95); } to { transform: scale(1); } }
                .animate-in { animation: fade-in 0.3s ease-out, zoom-in 0.3s ease-out; }
            `}</style>
        </div>
    );
};

export default Login;
