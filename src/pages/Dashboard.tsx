import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Users, 
  FileText, 
  ClipboardList, 
  BarChart3, 
  Calendar,
  CheckCircle,
  Clock,
  UserX,
  Eye,
  TrendingUp,
  School,
  BookOpen,
  ArrowRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalClasses: 0,
    todayAttendance: {
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0
    }
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch total students
      const { data: students } = await (supabase as any)
        .from('students')
        .select('id')
        .eq('is_active', true);

      // Fetch total classes
      const { data: classes } = await (supabase as any)
        .from('classes')
        .select('id');

      // Fetch today's attendance
      const today = new Date().toISOString().split('T')[0];
      const { data: attendance } = await (supabase as any)
        .from('attendance')
        .select('status')
        .eq('date', today);

      const attendanceStats = {
        hadir: attendance?.filter(a => a.status === 'Hadir').length || 0,
        sakit: attendance?.filter(a => a.status === 'Sakit').length || 0,
        izin: attendance?.filter(a => a.status === 'Izin').length || 0,
        alpha: attendance?.filter(a => a.status === 'Alpha').length || 0
      };

      setStats({
        totalStudents: students?.length || 0,
        totalClasses: classes?.length || 0,
        todayAttendance: attendanceStats
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const menuItems = [
    {
      title: "Input Absensi",
      subtitle: "Form",
      description: "Input absensi harian siswa",
      icon: ClipboardList,
      href: "/absensi",
      color: "bg-card",
      borderColor: "border-border",
      textColor: "text-foreground",
      iconColor: "text-primary",
      titleColor: "text-foreground"
    },
    {
      title: "Rekap Absensi", 
      subtitle: "Laporan",
      description: "Lihat rekap dan export data",
      icon: BarChart3,
      href: "/laporan",
      color: "bg-card",
      borderColor: "border-border",
      textColor: "text-foreground",
      iconColor: "text-primary",
      titleColor: "text-foreground"
    },
    {
      title: "Data Siswa",
      subtitle: "Siswa", 
      description: "Kelola data siswa",
      icon: Users,
      href: "/siswa",
      color: "bg-card",
      borderColor: "border-border",
      textColor: "text-foreground",
      iconColor: "text-primary",
      titleColor: "text-foreground"
    },
    {
      title: "Total Siswa",
      subtitle: stats.totalStudents.toString(),
      description: "Siswa aktif terdaftar",
      icon: School,
      href: "/siswa",
      color: "bg-card",
      borderColor: "border-border",
      textColor: "text-foreground",
      iconColor: "text-primary",
      titleColor: "text-foreground"
    }
  ];

  const totalToday = Object.values(stats.todayAttendance).reduce((a, b) => a + b, 0);
  const attendancePercentage = stats.totalStudents > 0 ? Math.round((stats.todayAttendance.hadir / stats.totalStudents) * 100) : 0;

  return (
    <Layout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-card rounded-xl p-8 border border-border">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center">
                  <School className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">
                    Sistem Absensi Digital
                  </h1>
                  <p className="text-lg text-foreground">
                    SMPN 3 KEBAKKRAMAT
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground max-w-2xl">
                Selamat datang di dashboard absensi digital. Pilih menu yang ingin Anda akses untuk mengelola absensi siswa dengan mudah dan efisien.
              </p>
            </div>
            <div className="hidden lg:flex items-center gap-4 text-right">
              <div className="text-sm text-muted-foreground">
                Hari ini: {new Date().toLocaleDateString('id-ID', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {menuItems.map((item, index) => (
            <Link key={index} to={item.href}>
              <Card className={`${item.borderColor} bg-card hover:shadow-lg transition-all duration-200 cursor-pointer group h-full`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <div className="space-y-1">
                    <CardTitle className={`text-sm font-medium ${item.textColor}`}>
                      {item.title}
                    </CardTitle>
                  </div>
                  <item.icon className={`h-5 w-5 ${item.iconColor} group-hover:scale-110 transition-transform`} />
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className={`text-2xl font-bold ${item.titleColor}`}>
                    {item.subtitle}
                  </div>
                  <p className={`text-xs ${item.textColor} leading-relaxed`}>
                    {item.description}
                  </p>
                  <div className="flex items-center justify-end pt-2">
                    <ArrowRight className={`h-4 w-4 ${item.iconColor} group-hover:translate-x-1 transition-transform`} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* System Information */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <CardTitle className="text-primary">Informasi Sistem</CardTitle>
                </div>
                <CardDescription>
                  Fitur dan kemampuan sistem absensi digital
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Fitur Utama:</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Input absensi dengan auto-complete NIS</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Rekap bulanan dengan filter lanjutan</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Export laporan ke format Excel</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-foreground">Manajemen Data:</h4>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Import data siswa dari Excel</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Validasi duplikasi otomatis</span>
                      </li>
                      <li className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Backup data terintegrasi</span>
                      </li>
                    </ul>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Tingkat Kehadiran Hari Ini</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {attendancePercentage}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Attendance Status */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-primary">Status Kehadiran</CardTitle>
                </div>
                <CardDescription>
                  Data absensi hari ini
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 border border-blue-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-sm font-medium text-blue-800">Hadir</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-bold">
                      {stats.todayAttendance.hadir}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium text-yellow-800">Sakit</span>
                    </div>
                    <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 font-bold">
                      {stats.todayAttendance.sakit}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 border border-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-500"></div>
                      <span className="text-sm font-medium text-slate-800">Izin</span>
                    </div>
                    <Badge variant="secondary" className="bg-slate-200 text-slate-800 font-bold">
                      {stats.todayAttendance.izin}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-sm font-medium text-red-800">Alpha</span>
                    </div>
                    <Badge variant="secondary" className="bg-red-100 text-red-800 font-bold">
                      {stats.todayAttendance.alpha}
                    </Badge>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="text-center space-y-2">
                    <div className="text-2xl font-bold text-education-primary">
                      {totalToday}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total siswa yang sudah diabsen
                    </div>
                    <Button 
                      asChild
                      variant="outline" 
                      size="sm"
                      className="w-full text-education-primary border-education-primary/20 hover:bg-education-primary/10"
                    >
                      <Link to="/laporan">
                        <Eye className="h-4 w-4 mr-2" />
                        Lihat Detail
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;