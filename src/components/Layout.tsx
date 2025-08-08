import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Users, 
  ClipboardList, 
  BarChart3, 
  Menu, 
  X,
  School,
  LogOut,
  User,
  Home,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home, shortName: "Home" },
  { name: "Form Absensi", href: "/absensi", icon: ClipboardList, shortName: "Absensi" },
  { name: "Data Siswa", href: "/siswa", icon: Users, shortName: "Siswa" },
  { name: "Laporan", href: "/laporan", icon: BarChart3, shortName: "Laporan" },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, adminUser, refreshSession } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleRefreshSession = () => {
    refreshSession();
  };

  const getSessionInfo = () => {
    const loginTime = localStorage.getItem("adminLoginTime");
    if (loginTime) {
      const loginDate = new Date(parseInt(loginTime));
      const now = new Date();
      const hoursLoggedIn = Math.floor((now.getTime() - loginDate.getTime()) / (1000 * 60 * 60));
      const minutesLoggedIn = Math.floor(((now.getTime() - loginDate.getTime()) % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hoursLoggedIn > 0) {
        return `${hoursLoggedIn}j ${minutesLoggedIn}m`;
      } else {
        return `${minutesLoggedIn}m`;
      }
    }
    return "";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 sm:h-16 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 sm:h-10 sm:w-10"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              {isSidebarOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
            </Button>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-education-primary to-education-secondary">
                <School className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base sm:text-lg font-bold text-foreground">SMPN 3 KEBAKKRAMAT</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">Manajemen Absensi Digital</p>
              </div>
              <div className="block sm:hidden">
                <h1 className="text-sm font-bold text-foreground">SMPN 3</h1>
                <p className="text-xs text-muted-foreground">Absensi Digital</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Sesi: {getSessionInfo()}</span>
              <Button
                onClick={handleRefreshSession}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-education-primary/10"
                title="Refresh Session"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-education-secondary">
              <User className="h-4 w-4" />
              <span className="text-sm font-medium">{adminUser?.fullName}</span>
            </div>
            <Button
              onClick={handleLogout}
              variant="outline"
              size="sm"
              className="border-education-primary/20 text-education-secondary hover:bg-education-primary/10 h-8 px-2 sm:h-9 sm:px-3"
            >
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
            <div className="text-xs sm:text-sm text-muted-foreground hidden lg:block">
              {new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex h-full flex-col pt-14 sm:pt-16 md:pt-0">
            <nav className="flex-1 space-y-1 p-3 sm:p-4">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors touch-manipulation",
                      isActive
                        ? "bg-gradient-to-r from-education-primary/10 to-education-secondary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted active:bg-muted/70"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t md:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors touch-manipulation min-w-0 flex-1",
                    isActive
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground hover:text-foreground active:bg-muted/50"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-xs font-medium truncate">{item.shortName}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-screen pb-16 md:pb-0">
          <div className="p-3 sm:p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}