
import React, { useState, FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import { APP_VERSION, FingerprintIcon, EyeIcon, EyeOffIcon, CloudUploadIcon, WarehouseIcon } from '../constants'; 
import { logActivity } from '../services/auditLogger';
import { Capacitor } from '@capacitor/core';

// Internal Icons for Login UI
const MailIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
    </svg>
);

const LockClosedIcon = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
);

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Update State
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [updateUrl, setUpdateUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // New Features States
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  
  // Security: Rate Limiting State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();

  // Check for existing lockout in localStorage on mount
  useEffect(() => {
      const savedLockout = localStorage.getItem('login_lockout');
      if (savedLockout) {
          const lockoutTime = parseInt(savedLockout, 10);
          if (lockoutTime > Date.now()) {
              setLockoutUntil(lockoutTime);
          } else {
              localStorage.removeItem('login_lockout');
          }
      }

      // Load saved email
      const savedEmail = localStorage.getItem('remember_email');
      if (savedEmail) {
          setUsername(savedEmail);
          setRememberMe(true);
      }
      
      checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
      try {
          // 1. Check Native (Android/iOS)
          if (Capacitor.isNativePlatform()) {
              // Dynamic import to avoid crashes on Web
              const { NativeBiometric } = await import('capacitor-native-biometric');
              const result = await NativeBiometric.isAvailable();
              if (result.isAvailable) {
                  setIsBiometricSupported(true);
              }
          } else {
              // 2. Check Web
              const isIframe = window.self !== window.top;
              if (!isIframe && ((window as any).PasswordCredential || (navigator.credentials && navigator.credentials.get))) {
                  setIsBiometricSupported(true);
              }
          }
      } catch (e) {
          console.log("Biometric check failed:", e);
      }
  };

  // Helper to compare versions (e.g. "1.0.10" > "1.0.9")
  const isVersionNewer = (remoteVer: string, localVer: string): boolean => {
      const rParts = remoteVer.split('.').map(Number);
      const lParts = localVer.split('.').map(Number);
      
      for (let i = 0; i < Math.max(rParts.length, lParts.length); i++) {
          const r = rParts[i] || 0;
          const l = lParts[i] || 0;
          if (r > l) return true;
          if (r < l) return false;
      }
      return false; // Equal
  };

  useEffect(() => {
      const checkVersion = async () => {
          try {
              const { data } = await supabase
                  .from('app_settings')
                  .select('key, value')
                  .in('key', ['app_version', 'app_update_url']);
              
              if (!data) return;

              const latestVersion = data.find(d => d.key === 'app_version')?.value;
              const downloadUrl = data.find(d => d.key === 'app_update_url')?.value;

              // Only show warning if Remote Version is NEWER than App Version
              if (latestVersion && isVersionNewer(latestVersion, APP_VERSION)) {
                  setVersionWarning(`Versi baru tersedia: ${latestVersion}`);
                  if (downloadUrl) setUpdateUrl(downloadUrl);
              }
          } catch (err: any) {}
      };
      checkVersion();
  }, []);

  // Timer to clear lockout
  useEffect(() => {
      let timer: any;
      if (lockoutUntil) {
          timer = setInterval(() => {
              if (Date.now() > lockoutUntil) {
                  setLockoutUntil(null);
                  setFailedAttempts(0);
                  localStorage.removeItem('login_lockout');
                  setError('');
              }
          }, 1000);
      }
      return () => clearInterval(timer);
  }, [lockoutUntil]);

  const handleBiometricLogin = async () => {
      setError('');
      
      // --- A. NATIVE APP LOGIC (Capacitor - Android/iOS) ---
      if (Capacitor.isNativePlatform()) {
          try {
              // 1. Check for stored credentials FIRST
              const storedUser = localStorage.getItem('saved_biometric_user');
              const storedPass = localStorage.getItem('saved_biometric_pass');

              if (!storedUser || !storedPass) {
                  // Show native alert (using window.alert works in WebView)
                  alert('Belum ada data login tersimpan. Silakan login manual sekali dan centang "Ingat Saya" untuk mengaktifkan sidik jari.');
                  return;
              }

              const { NativeBiometric } = await import('capacitor-native-biometric');
              
              // 2. Verify Fingerprint/FaceID
              // The verifyIdentity function returns Promise<void> on success and throws on failure/cancellation.
              await NativeBiometric.verifyIdentity({
                  reason: "Login untuk mengakses aplikasi",
                  title: "Login Biometrik",
                  subtitle: "Gunakan sidik jari atau wajah",
                  description: "Konfirmasi identitas Anda untuk masuk"
              });

              // If we get here, verification was successful
              setLoading(true);
              setUsername(storedUser); // Visual feedback
              
              const { data, error } = await signIn(storedUser, storedPass);
              
              if (error) {
                  setError('Login gagal. Password mungkin telah berubah. Silakan login manual.');
                  setLoading(false);
              } else {
                  setFailedAttempts(0);
                  if (data.user) await logActivity(data.user as any, 'LOGIN_BIOMETRIC_NATIVE', 'User logged in via Native Biometric');
                  redirectUser(data.user);
              }
          } catch (e: any) {
               console.warn("Native biometric failed:", e);
               // Do not set error if user cancelled to keep UI clean, or set a mild message
               // setError('Verifikasi biometrik dibatalkan.');
          }
          return;
      }

      // --- B. WEB BROWSER LOGIC (WebAuthn) ---
      try {
          if (!navigator.credentials) {
              setError('Browser ini tidak mendukung login cepat.');
              return;
          }

          if (window.self !== window.top) {
              setError('Login biometrik tidak tersedia dalam mode preview/iframe.');
              return;
          }

          const cred = await navigator.credentials.get({ password: true } as any) as any;
          
          if (cred && cred.id && cred.password) {
              setLoading(true);
              setUsername(cred.id);
              setPassword(cred.password);
              
              const { data, error } = await signIn(cred.id, cred.password);
              
              if (error) {
                  setError('Login gagal: Kredensial tidak valid.');
                  setLoading(false);
              } else {
                  setFailedAttempts(0);
                  if (data.user) await logActivity(data.user as any, 'LOGIN_BIOMETRIC_WEB', 'User logged in via WebAuthn');
                  redirectUser(data.user);
              }
          }
      } catch (e: any) {
          console.warn("Web biometric failed:", e);
          // Silent fail or show mild error
      }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (lockoutUntil) return;

    setLoading(true);
    setError('');
    
    const { data, error } = await signIn(username, password);
    
    if (error) {
      const newFailCount = failedAttempts + 1;
      setFailedAttempts(newFailCount);

      if (newFailCount >= 5) {
          const lockoutTime = Date.now() + 30 * 1000; 
          setLockoutUntil(lockoutTime);
          localStorage.setItem('login_lockout', lockoutTime.toString());
          setError('Terlalu banyak percobaan gagal. Silakan tunggu 30 detik.');
      } else {
          setError('Username atau password salah.');
      }
    } else {
      // Success
      setFailedAttempts(0);
      setLockoutUntil(null);
      localStorage.removeItem('login_lockout');
      
      // Handle Remember Me & Credential Storage
      if (rememberMe) {
          localStorage.setItem('remember_email', username);
          
          // Store for Native Biometric Fallback (Android/iOS)
          localStorage.setItem('saved_biometric_user', username);
          localStorage.setItem('saved_biometric_pass', password); 
      } else {
          localStorage.removeItem('remember_email');
          localStorage.removeItem('saved_biometric_user');
          localStorage.removeItem('saved_biometric_pass');
      }

      // Web Browser Credential Storage (Chrome/Safari Password Manager)
      if (!Capacitor.isNativePlatform() && window.self === window.top && (window as any).PasswordCredential && navigator.credentials) {
          try {
              const cred = new (window as any).PasswordCredential({
                  id: username,
                  password: password,
                  name: username,
              });
              await navigator.credentials.store(cred);
          } catch (e) {}
      }

      if (data.user) await logActivity(data.user as any, 'LOGIN', 'User logged in successfully');
      redirectUser(data.user);
    }
    setLoading(false);
  };

  const redirectUser = (user: any) => {
      // Check app_metadata first, then user_metadata
      const role = user?.app_metadata?.role || user?.user_metadata?.role;
      
      if (role === 'admin' || role === 'manager') {
        navigate('/dashboard');
      } else if (role === 'operator') {
        navigate('/input');
      } else if (role === 'viewer') {
        navigate('/stock');
      } else {
        setError('Akun Anda tidak memiliki role yang valid. Hubungi admin.');
        signOut();
      }
  };
  
  const handleUpdateClick = () => {
      if (updateUrl) {
          setIsDownloading(true);
          // Small delay to show feedback
          setTimeout(() => {
            window.open(updateUrl, '_blank');
            setIsDownloading(false);
          }, 1000);
      } else {
          if (!Capacitor.isNativePlatform()) {
              window.location.reload();
          }
      }
  };

  const isLocked = lockoutUntil !== null && Date.now() < lockoutUntil;

  return (
    <div className="min-h-screen w-full flex flex-col justify-center px-6 lg:px-8 bg-white dark:bg-slate-950 relative overflow-hidden">
      
      {/* Decorative Background Elements (Mobile App Style) */}
      <div className="absolute top-[-10%] right-[-5%] w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Blocking Update Modal */}
      {versionWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center border-t-4 border-blue-500 transform transition-all scale-100">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-6 animate-pulse">
                    <CloudUploadIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                    Update Tersedia
                </h2>
                <p className="text-slate-600 dark:text-slate-300 mb-2 font-medium">
                    {versionWarning} (Anda: v{APP_VERSION})
                </p>
                
                <div className="flex flex-col gap-3 mt-6">
                    <button 
                        onClick={handleUpdateClick}
                        disabled={isDownloading || (!updateUrl && Capacitor.isNativePlatform())}
                        className={`w-full py-3 px-4 text-white rounded-xl font-bold shadow-lg shadow-blue-500/30 transition-all transform active:scale-95 flex justify-center items-center ${
                            (!updateUrl && Capacitor.isNativePlatform()) 
                            ? 'bg-slate-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                        }`}
                    >
                        {isDownloading ? "Mengunduh..." : updateUrl ? "Update Sekarang" : "Refresh"}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Main Login Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        
        {/* Modern Header Section */}
        <div className="mb-10 flex flex-col items-center text-center">
            <div className="h-24 w-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/30 mb-6 transform rotate-3 transition-transform hover:rotate-6">
                <WarehouseIcon className="h-12 w-12 text-white" />
            </div>
            <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Let's Sign You In.
            </h2>
            <p className="mt-3 text-slate-500 dark:text-slate-400 text-lg font-medium">
                Welcome back, {rememberMe ? 'User' : 'Guest'}!
            </p>
        </div>

        <form className="space-y-6" onSubmit={handleLogin}>
          
          {/* Username Input */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600">
                <MailIcon className="h-6 w-6 text-slate-400" />
            </div>
            <input
                id="username"
                name="username"
                type="text" // using text to allow username or email
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username / Email"
                disabled={!!versionWarning || isLocked}
                className="block w-full pl-12 pr-4 py-4 bg-slate-100 dark:bg-slate-800 border-2 border-transparent text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-0 transition-all font-medium text-base shadow-sm"
            />
          </div>

          {/* Password Input */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-blue-600">
                <LockClosedIcon className="h-6 w-6 text-slate-400" />
            </div>
            <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                disabled={!!versionWarning || isLocked}
                className="block w-full pl-12 pr-12 py-4 bg-slate-100 dark:bg-slate-800 border-2 border-transparent text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl focus:outline-none focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500 focus:ring-0 transition-all font-medium text-base shadow-sm"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 focus:outline-none p-1"
                >
                    {showPassword ? <EyeOffIcon className="h-6 w-6" /> : <EyeIcon className="h-6 w-6" />}
                </button>
            </div>
          </div>

          {/* Options: Remember Me */}
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-slate-300 rounded transition-all"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
                Ingat Saya
              </label>
            </div>
            {/* Can add 'Forgot Password?' link here later */}
          </div>

          {/* Error Message Display */}
          {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-shake">
                  <p className="text-sm text-red-600 dark:text-red-400 font-bold text-center">
                      {error}
                      {isLocked && lockoutUntil && (
                          <span className="block mt-1 font-normal opacity-80">
                              Coba lagi dalam {Math.ceil((lockoutUntil - Date.now()) / 1000)} detik.
                          </span>
                      )}
                  </p>
              </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-4 pt-2">
            <button
                type="submit"
                disabled={loading || !!versionWarning || isLocked}
                className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-lg shadow-blue-600/30 text-lg font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] transition-all"
            >
              {loading ? (
                <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                 isLocked ? 'Terkunci' : 'Sign In'
              )}
            </button>

            {isBiometricSupported && !isLocked && (
                 <button
                    type="button"
                    onClick={handleBiometricLogin}
                    className="w-full flex justify-center items-center py-4 px-4 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base font-bold text-slate-600 dark:text-slate-300 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors transform active:scale-[0.98]"
                 >
                     <FingerprintIcon className="h-6 w-6 mr-2 text-blue-600" />
                     Login Cepat
                 </button>
            )}
          </div>
        </form>
      </div>
      
      {/* Minimal Footer */}
      <div className="mt-12 text-center z-10">
        <p className="text-xs font-medium text-slate-400 dark:text-slate-600">
            Storage Management v{APP_VERSION}
        </p>
      </div>
    </div>
  );
};

export default Login;
