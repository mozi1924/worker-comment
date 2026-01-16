import React, { useState, useEffect, useRef } from 'react';
import { Mail, Lock, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string) => void;
  workerUrl: string;
}

declare global {
  interface Window {
    turnstile: any;
    onloadTurnstileCallback?: () => void;
  }
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, workerUrl }) => {
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    // Inject Turnstile Script
    const scriptId = 'cloudflare-turnstile-script';
    const existingScript = document.getElementById(scriptId);

    if (!existingScript) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => setIsScriptLoaded(true);
      document.body.appendChild(script);
    } else {
        // If script is already there, check if turnstile object is available
        if (window.turnstile) {
            setIsScriptLoaded(true);
        } else {
            // It might be loading, we can attach onload to existing script if it's not ready?
            // Safer to just poll or rely on it eventually being ready. 
            // For simplicity in this common case, we'll assume if it's there it's loading or loaded.
            // We can attach an onload just in case it's still fetching.
            existingScript.addEventListener('load', () => setIsScriptLoaded(true));
        }
    }
  }, []);

  useEffect(() => {
    if (step === 'email' && isScriptLoaded && window.turnstile && turnstileContainerRef.current && !widgetId.current) {
        try {
            widgetId.current = window.turnstile.render(turnstileContainerRef.current, {
                sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA', // Usage of env var
                callback: (token: string) => setTurnstileToken(token),
                'expired-callback': () => setTurnstileToken(''),
            });
        } catch (e) {
            console.error("Turnstile render error", e);
        }
    }
    
    return () => {
         if (widgetId.current && window.turnstile) {
            window.turnstile.remove(widgetId.current);
            widgetId.current = null;
         }
    }
  }, [step, isScriptLoaded]);


  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) {
        setError('Please complete the security check.');
        return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${workerUrl}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstile_token: turnstileToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep('otp');
        setSuccess('Verification code sent to your email (if valid).');
      } else {
        setError(data.error || 'Failed to send code');
        // Reset turnstile on error
        if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
        setTurnstileToken('');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${workerUrl}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        onLogin(data.token);
      } else {
        setError(data.error || 'Invalid code');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 transform transition-all">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Admin Access</h2>
          <p className="text-gray-500 mt-2">Manage your comments secure and easy.</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && step === 'otp' && (
          <div className="mb-6 bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg flex items-center">
            <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendCode} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            
            {/* Turnstile Container */}
            <div className="flex justify-center min-h-[65px]" ref={turnstileContainerRef}></div>

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                <>
                  Send Verification Code
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-1">
                Verification Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="otp"
                  type="text"
                  required
                  maxLength={6}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-center tracking-[0.5em] font-mono text-lg"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <div className="text-center mt-2">
                 <button
                    type="button"
                    onClick={() => { setStep('email'); setError(null); setSuccess(null); setTurnstileToken(''); }}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                 >
                    Change Email
                 </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Verifying...
                </>
              ) : (
                'Verify & Login'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
