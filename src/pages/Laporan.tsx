import { useState, useEffect } from "react";
import { BarChart3, Calendar, Download, Filter, Edit, Trash2, Save, X } from "lucide-react";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";

interface AttendanceReport {
  student_id: string;
  student_name: string;
  student_nis: string;
  class_name: string;
  total_days: number;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
  percentage: number;
}

const Laporan = () => {
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
  const [todayStats, setTodayStats] = useState({ hadir: 0, izin: 0, sakit: 0, alpha: 0, total: 0 });
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const { toast } = useToast();

  useEffect(() => {
    fetchClasses();
    fetchTodayAttendance();
  }, []);

  useEffect(() => {
    generateReport();
  }, [selectedClass, selectedMonth, selectedYear, classes]);

  const fetchClasses = async () => {
    try {
      // Since classes table was dropped, get unique class names from students
      const { data, error } = await (supabase as any)
        .from('students')
        .select('class_name')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get unique class names
      const uniqueClasses = [...new Set(data?.map(s => s.class_name).filter(Boolean))];
      const classesData = uniqueClasses.map(name => ({ name, id: name }));
      
      setClasses(classesData);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's attendance with student details
      const { data, error } = await (supabase as any)
        .from('attendance')
        .select(`
          *,
          students!inner(
            id,
            student_id,
            name,
            class_name,
            gender
          )
        `)
        .eq('date', today)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const attendanceData = data?.map((record: any) => ({
        id: record.id,
        status: record.status,
        notes: record.notes,
        student_name: record.students.name,
        student_nis: record.students.student_id,
        class_name: record.students.class_name,
        gender: record.students.gender,
        created_at: record.created_at
      })) || [];
      
      setTodayAttendance(attendanceData);
      
      // Calculate today's stats
      const stats = {
        hadir: attendanceData.filter(a => a.status === 'Hadir').length,
        izin: attendanceData.filter(a => a.status === 'Izin').length,
        sakit: attendanceData.filter(a => a.status === 'Sakit').length,
        alpha: attendanceData.filter(a => a.status === 'Alpha').length,
        total: attendanceData.length
      };
      
      setTodayStats(stats);
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Get the first and last day of the selected month
      const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth, 0).toISOString().split('T')[0];

      // Build query for students with the correct structure
      let studentsQuery = (supabase as any)
        .from('students')
        .select('id, student_id, name, class_name, gender')
        .eq('is_active', true);

      if (selectedClass !== "all") {
        studentsQuery = studentsQuery.eq('class_name', selectedClass);
      }

      const { data: students, error: studentsError } = await studentsQuery;
      if (studentsError) throw studentsError;

      // Get attendance data for the period
      const { data: attendanceData, error: attendanceError } = await (supabase as any)
        .from('attendance')
        .select('*')
        .gte('date', startDate)
        .lte('date', endDate);

      if (attendanceError) throw attendanceError;

      // Calculate working days in the month (excluding weekends for now)
      const workingDays = getWorkingDaysInMonth(selectedYear, selectedMonth - 1);

      // Process the data
      const reportData: AttendanceReport[] = students.map((student: any) => {
        const studentAttendance = attendanceData.filter((att: any) => att.student_id === student.id);
        
        const statusCounts = {
          hadir: studentAttendance.filter((att: any) => att.status === 'Hadir').length,
          izin: studentAttendance.filter((att: any) => att.status === 'Izin').length,
          sakit: studentAttendance.filter((att: any) => att.status === 'Sakit').length,
          alpha: studentAttendance.filter((att: any) => att.status === 'Alpha').length,
        };

        const totalRecorded = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
        const percentage = workingDays > 0 ? Math.round((statusCounts.hadir / workingDays) * 100) : 0;

        return {
          student_id: student.id,
          student_name: student.name,
          student_nis: student.student_id,
          class_name: student.class_name,
          total_days: workingDays,
          ...statusCounts,
          percentage
        };
      });

      // Sort by class name and then by student name
      const sortedReportData = reportData.sort((a, b) => {
        if (a.class_name !== b.class_name) {
          return (a.class_name || '').localeCompare(b.class_name || '');
        }
        return a.student_name.localeCompare(b.student_name);
      });

      setReports(sortedReportData);
      setCurrentPage(1); // Reset to first page when generating new report
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Gagal membuat laporan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWorkingDaysInMonth = (year: number, month: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let workingDays = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayOfWeek = date.getDay();
      // Exclude Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    
    return workingDays;
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 90) return "bg-education-success";
    if (percentage >= 80) return "bg-education-accent";
    if (percentage >= 70) return "bg-education-warning";
    return "bg-destructive";
  };

  const exportReport = () => {
    if (reports.length === 0) {
      toast({
        title: "Tidak Ada Data",
        description: "Tidak ada data untuk diekspor",
        variant: "destructive",
      });
      return;
    }

    try {
      // Sort data by class name and then by student name
      const sortedReports = [...reports].sort((a, b) => {
        if (a.class_name !== b.class_name) {
          return (a.class_name || '').localeCompare(b.class_name || '');
        }
        return a.student_name.localeCompare(b.student_name);
      });

      // Prepare data for Excel
      const excelData = sortedReports.map((report, index) => ({
        'No': index + 1,
        'NIS': report.student_nis,
        'Nama Siswa': report.student_name,
        'Kelas': report.class_name,
        'Total Hari Kerja': report.total_days,
        'Hadir': report.hadir,
        'Izin': report.izin,
        'Sakit': report.sakit,
        'Alpha': report.alpha,
        'Persentase Kehadiran (%)': report.percentage
      }));

      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 5 },  // No
        { wch: 12 }, // NIS
        { wch: 25 }, // Nama Siswa
        { wch: 10 }, // Kelas
        { wch: 15 }, // Total Hari Kerja
        { wch: 8 },  // Hadir
        { wch: 8 },  // Izin
        { wch: 8 },  // Sakit
        { wch: 8 },  // Alpha
        { wch: 20 }  // Persentase
      ];
      worksheet['!cols'] = colWidths;

      // Add worksheet to workbook
      const monthName = new Date(2024, selectedMonth - 1).toLocaleDateString('id-ID', { month: 'long' });
      const sheetName = selectedClass === 'all' 
        ? `Semua Kelas - ${monthName} ${selectedYear}`
        : `${selectedClass} - ${monthName} ${selectedYear}`;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      // Generate filename
      const filename = selectedClass === 'all'
        ? `Laporan_Absensi_Semua_Kelas_${monthName}_${selectedYear}.xlsx`
        : `Laporan_Absensi_${selectedClass}_${monthName}_${selectedYear}.xlsx`;

      // Save file
      XLSX.writeFile(workbook, filename);

      toast({
        title: "Export Berhasil",
        description: `Data berhasil diekspor ke file ${filename}`,
      });
    } catch (error) {
      console.error('Error exporting report:', error);
      toast({
        title: "Error",
        description: "Gagal mengekspor data ke Excel",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Hadir':
        return 'default';
      case 'Izin':
        return 'secondary';
      case 'Sakit':
        return 'outline';
      case 'Alpha':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getStatusCardColor = (status: string) => {
    switch (status) {
      case 'Alpha':
        return 'bg-red-500 text-white';
      case 'Sakit':
        return 'bg-yellow-500 text-white';
      case 'Izin':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-green-500 text-white';
    }
  };

  const handleEditRecord = (record: any) => {
    setEditingRecord({ ...record });
    setEditDialogOpen(true);
  };

  const handleUpdateRecord = async () => {
    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from('attendance')
        .update({
          status: editingRecord.status,
          notes: editingRecord.notes
        })
        .eq('id', editingRecord.id);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data absensi berhasil diperbarui",
      });

      setEditDialogOpen(false);
      setEditingRecord(null);
      fetchTodayAttendance();
    } catch (error) {
      console.error('Error updating attendance:', error);
      toast({
        title: "Error",
        description: "Gagal memperbarui data absensi",
        variant: "destructive",
      });
    }
  };

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data absensi ini?')) return;

    try {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', recordId);

      if (error) throw error;

      toast({
        title: "Berhasil",
        description: "Data absensi berhasil dihapus",
      });

      fetchTodayAttendance();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus data absensi",
        variant: "destructive",
      });
    }
  };

  // Pagination calculations
  const totalPages = Math.ceil(reports.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentPageReports = reports.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Today's Attendance Section */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-50 to-green-50 border-b border-blue-200">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-blue-600" />
              Absensi Hari Ini
            </CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString('id-ID', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Today's Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {todayStats.total}
                  </div>
                  <p className="text-sm text-blue-600">Total Absen</p>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {todayStats.hadir}
                  </div>
                  <p className="text-sm text-green-600">Hadir</p>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 bg-yellow-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-700">
                    {todayStats.izin}
                  </div>
                  <p className="text-sm text-yellow-600">Izin</p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-purple-700">
                    {todayStats.sakit}
                  </div>
                  <p className="text-sm text-purple-600">Sakit</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">
                    {todayStats.alpha}
                  </div>
                  <p className="text-sm text-red-600">Alpha</p>
                </CardContent>
              </Card>
            </div>
            
            {/* Today's Attendance List */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold mb-4">Daftar Absensi Hari Ini ({todayAttendance.length})</h3>
              {todayAttendance.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {todayAttendance.map((record, index) => (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium">{record.student_name}</div>
                        <div className="text-sm text-gray-600">
                          NIS: {record.student_nis} • {record.class_name} • {record.gender}
                        </div>
                        {record.notes && (
                          <div className="text-sm text-gray-500 italic">Ket: {record.notes}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={getStatusCardColor(record.status)}
                        >
                          {record.status}
                        </Badge>
                        <div className="text-xs text-gray-500">
                          {new Date(record.created_at).toLocaleTimeString('id-ID', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRecord(record)}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteRecord(record.id)}
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Belum ada data absensi hari ini</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="bg-gradient-to-r from-education-primary/10 to-education-accent/10 border-b border-education-accent/20">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-education-primary" />
              Laporan Absensi Bulanan
            </CardTitle>
            <CardDescription>
              Rekap kehadiran siswa SMPN 3 KEBAKKRAMAT per bulan
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Bulan</label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {new Date(2024, i).toLocaleDateString('id-ID', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tahun</label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Kelas</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {classes.map(cls => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={exportReport}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Excel
                </Button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-700">
                    {reports.reduce((sum, r) => sum + r.hadir, 0)}
                  </div>
                  <p className="text-sm text-green-600">Total Hadir</p>
                </CardContent>
              </Card>
              <Card className="border-education-accent/20 bg-gradient-to-br from-education-accent/5 to-education-primary/5">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-education-secondary">
                    {reports.reduce((sum, r) => sum + r.izin, 0)}
                  </div>
                  <p className="text-sm text-education-secondary/70">Total Izin</p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-700">
                    {reports.reduce((sum, r) => sum + r.sakit, 0)}
                  </div>
                  <p className="text-sm text-blue-600">Total Sakit</p>
                </CardContent>
              </Card>
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-red-700">
                    {reports.reduce((sum, r) => sum + r.alpha, 0)}
                  </div>
                  <p className="text-sm text-red-600">Total Alpha</p>
                </CardContent>
              </Card>
            </div>

            {/* Reports Table */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    Detail Laporan ({reports.length} siswa)
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {currentPageReports.length} dari {reports.length} siswa
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Tampilkan:</span>
                    <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-sm text-muted-foreground">per halaman</span>
                  </div>
                  {loading && (
                    <div className="text-sm text-muted-foreground">Memuat data...</div>
                  )}
                </div>
              </div>
              
              <div className="space-y-3">
                {currentPageReports.map(report => (
                  <Card key={report.student_id} className="border border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{report.student_name}</h4>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>NIS: {report.student_nis}</span>
                            <Badge variant="outline">{report.class_name}</Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white ${getStatusColor(report.percentage)}`}>
                            {report.percentage}% Kehadiran
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Hari Kerja:</span>
                          <div className="font-medium">{report.total_days}</div>
                        </div>
                        <div>
                          <span className="text-green-600">Hadir:</span>
                          <div className="font-medium text-green-700">{report.hadir}</div>
                        </div>
                        <div>
                          <span className="text-education-accent">Izin:</span>
                          <div className="font-medium text-education-secondary">{report.izin}</div>
                        </div>
                        <div>
                          <span className="text-blue-600">Sakit:</span>
                          <div className="font-medium text-blue-700">{report.sakit}</div>
                        </div>
                        <div>
                          <span className="text-red-600">Alpha:</span>
                          <div className="font-medium text-red-700">{report.alpha}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tidak Hadir:</span>
                          <div className="font-medium">{report.izin + report.sakit + report.alpha}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {reports.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Belum ada data absensi untuk periode ini</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                  <div className="text-sm text-muted-foreground">
                    Halaman {currentPage} dari {totalPages}
                  </div>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage > 1) handlePageChange(currentPage - 1);
                          }}
                          className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNumber;
                        if (totalPages <= 5) {
                          pageNumber = i + 1;
                        } else if (currentPage <= 3) {
                          pageNumber = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNumber = totalPages - 4 + i;
                        } else {
                          pageNumber = currentPage - 2 + i;
                        }
                        
                        return (
                          <PaginationItem key={pageNumber}>
                            <PaginationLink
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                handlePageChange(pageNumber);
                              }}
                              isActive={currentPage === pageNumber}
                            >
                              {pageNumber}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      {totalPages > 5 && currentPage < totalPages - 2 && (
                        <PaginationItem>
                          <PaginationEllipsis />
                        </PaginationItem>
                      )}
                      
                      <PaginationItem>
                        <PaginationNext 
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (currentPage < totalPages) handlePageChange(currentPage + 1);
                          }}
                          className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit Data Absensi</DialogTitle>
              <DialogDescription>
                Ubah status kehadiran dan keterangan untuk {editingRecord?.student_name}
              </DialogDescription>
            </DialogHeader>
            {editingRecord && (
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="status">Status Kehadiran</Label>
                  <Select
                    value={editingRecord.status}
                    onValueChange={(value) => setEditingRecord({ ...editingRecord, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hadir">Hadir</SelectItem>
                      <SelectItem value="Izin">Izin</SelectItem>
                      <SelectItem value="Sakit">Sakit</SelectItem>
                      <SelectItem value="Alpha">Alpha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">Keterangan</Label>
                  <Input
                    id="notes"
                    value={editingRecord.notes || ''}
                    onChange={(e) => setEditingRecord({ ...editingRecord, notes: e.target.value })}
                    placeholder="Keterangan tambahan (opsional)"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Batal
              </Button>
              <Button onClick={handleUpdateRecord}>
                <Save className="h-4 w-4 mr-2" />
                Simpan
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Laporan;