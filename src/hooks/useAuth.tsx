import { useState, useEffect, createContext, useContext, ReactNode } from "react";

interface AuthContextType {
  isLoggedIn: boolean;
  adminUser: any;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [adminUser, setAdminUser] = useState(null);

  useEffect(() => {
    const loginStatus = localStorage.getItem("isAdminLoggedIn");
    const user = localStorage.getItem("adminUser");
    
    if (loginStatus === "true" && user) {
      setIsLoggedIn(true);
      setAdminUser(JSON.parse(user));
    }
  }, []);

  const logout = () => {
    localStorage.removeItem("isAdminLoggedIn");
    localStorage.removeItem("adminUser");
    setIsLoggedIn(false);
    setAdminUser(null);
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, adminUser, logout }}>
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