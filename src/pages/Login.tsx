import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For now, using simple check - in production use proper password hashing
      if (username === "admin" && password === "@Smp2025") {
        // Store login status in localStorage
        localStorage.setItem("isAdminLoggedIn", "true");
        localStorage.setItem("adminUser", JSON.stringify({
          username: "admin",
          fullName: "Administrator SMPN 3 KEBAKKRAMAT"
        }));
        
        toast({
          title: "Login Berhasil",
          description: "Selamat datang di Sistem Absensi SMPN 3 KEBAKKRAMAT",
        });
        
        navigate("/");
      } else {
        toast({
          title: "Login Gagal",
          description: "Username atau password salah",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Terjadi kesalahan saat login",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-education-primary/5 p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-education-primary to-education-secondary rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-white">S3K</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-education-secondary">
              Login Admin
            </CardTitle>
            <CardDescription className="text-education-secondary/70">
              Manajemen Absensi Digital SMPN 3 KEBAKKRAMAT
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-education-secondary font-medium">
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                required
                className="border-education-primary/20 focus:border-education-primary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-education-secondary font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                required
                className="border-education-primary/20 focus:border-education-primary"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-education-primary to-education-secondary hover:from-education-primary/90 hover:to-education-secondary/90 text-white font-medium py-2"
              disabled={isLoading}
            >
              {isLoading ? "Memproses..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}