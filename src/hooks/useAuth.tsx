import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  adminUser: any;
  logout: () => void;
  refreshSession: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Session duration: 8 hours (in milliseconds)
const SESSION_DURATION = 8 * 60 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const checkAuthState = () => {
      try {
        const loginStatus = localStorage.getItem("isAdminLoggedIn");
        const user = localStorage.getItem("adminUser");
        const loginTime = localStorage.getItem("adminLoginTime");
        
        if (loginStatus === "true" && user && loginTime) {
          const currentTime = Date.now();
          const sessionAge = currentTime - parseInt(loginTime);
          
          // Check if session is still valid (within 8 hours)
          if (sessionAge < SESSION_DURATION) {
            setIsLoggedIn(true);
            setAdminUser(JSON.parse(user));
            
            // Update last activity time
            localStorage.setItem("adminLastActivity", currentTime.toString());
          } else {
            // Session expired, clear auth data
            clearAuthData();
          }
        } else {
          clearAuthData();
        }
      } catch (error) {
        console.error("Error checking auth state:", error);
        clearAuthData();
      }
      
      setIsInitialized(true);
    };

    const clearAuthData = () => {
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("adminUser");
      localStorage.removeItem("adminLoginTime");
      localStorage.removeItem("adminLastActivity");
      setIsLoggedIn(false);
      setAdminUser(null);
    };

    // Check initial state
    checkAuthState();

    // Listen for auth state changes
    const handleAuthChange = () => {
      checkAuthState();
    };

    // Listen for user activity to refresh session
    const handleUserActivity = () => {
      if (isLoggedIn) {
        const currentTime = Date.now();
        localStorage.setItem("adminLastActivity", currentTime.toString());
      }
    };

    // Set up event listeners
    window.addEventListener('auth-state-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange);
    
    // Track user activity
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    window.addEventListener('mousemove', handleUserActivity);

    // Check session validity every 5 minutes
    const sessionCheckInterval = setInterval(() => {
      if (isLoggedIn) {
        const loginTime = localStorage.getItem("adminLoginTime");
        const lastActivity = localStorage.getItem("adminLastActivity");
        
        if (loginTime && lastActivity) {
          const currentTime = Date.now();
          const sessionAge = currentTime - parseInt(loginTime);
          const timeSinceActivity = currentTime - parseInt(lastActivity);
          
          // Auto-logout if session is older than 8 hours OR no activity for 2 hours
          if (sessionAge > SESSION_DURATION || timeSinceActivity > (2 * 60 * 60 * 1000)) {
            logout();
          }
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => {
      window.removeEventListener('auth-state-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      window.removeEventListener('mousemove', handleUserActivity);
      clearInterval(sessionCheckInterval);
    };
  }, [isLoggedIn]);

  const refreshSession = () => {
    if (isLoggedIn) {
      const currentTime = Date.now();
      localStorage.setItem("adminLastActivity", currentTime.toString());
    }
  };

  const logout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("adminLoginTime");
    localStorage.removeItem("adminLastActivity");
    setIsLoggedIn(false);
    setAdminUser(null);
    window.dispatchEvent(new Event('auth-state-change'));
  };

  // Don't render children until auth state is initialized
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isLoggedIn, adminUser, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}