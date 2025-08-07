import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ArrowLeft, Clock, User, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { supabase } from "@/integrations/supabase/client";

interface Student {
  id: string;
  student_id: string;
  name: string;
  class_name: string;
  gender: string;
}

const statusOptions = [
  { value: "Hadir", label: "Hadir" },
  { value: "Izin", label: "Izin" },
  { value: "Sakit", label: "Sakit" },
  { value: "Alpha", label: "Alpha" },
];

const getDayName = (date: string) => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const dayIndex = new Date(date).getDay();
  return days[dayIndex];
};

export function AttendanceForm() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [recentStudents, setRecentStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [showRecentStudents, setShowRecentStudents] = useState(true);
  const debouncedSearchValue = useDebounce(searchValue, 150); // Faster debounce
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load recent students on component mount
  useEffect(() => {
    loadRecentStudents();
  }, []);

  useEffect(() => {
    if (debouncedSearchValue.length > 0) {
      setShowRecentStudents(false);
      fetchStudents(debouncedSearchValue);
    } else {
      setStudents([]);
      setShowRecentStudents(true);
    }
  }, [debouncedSearchValue]);

  // Focus search input when popover opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  const loadRecentStudents = async () => {
    try {
      // Get recent students from today's attendance or recent searches
      const { data, error } = await (supabase as any)
        .from("attendance")
        .select(`
          students!inner(
            id,
            student_id,
            name,
            gender,
            class_name
          )
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      
      const formattedStudents = data?.map((record: any) => ({
        id: record.students.id,
        student_id: record.students.student_id,
        name: record.students.name,
        gender: record.students.gender || "",
        class_name: record.students.class_name || "Belum Ditentukan"
      })) || [];
      
      // Remove duplicates based on student ID
      const uniqueStudents = formattedStudents.filter((student, index, self) => 
        index === self.findIndex(s => s.id === student.id)
      );
      
      setRecentStudents(uniqueStudents);
    } catch (error) {
      console.error("Error loading recent students:", error);
      // If there's an error with recent students, let's try to get some students directly
      try {
        const { data: studentsData, error: studentsError } = await (supabase as any)
          .from("students")
          .select('id, student_id, name, gender, class_name')
          .eq("is_active", true)
          .order('name')
          .limit(5);
        
        if (!studentsError && studentsData) {
          setRecentStudents(studentsData.map(student => ({
            ...student,
            class_name: student.class_name || "Belum Ditentukan"
          })));
        }
      } catch (fallbackError) {
        console.error("Error loading fallback students:", fallbackError);
      }
    }
  };

  const fetchStudents = async (searchTerm: string) => {
    setIsSearching(true);
    try {
      // Clean search term
      const cleanSearchTerm = searchTerm.trim();
      
      const { data, error } = await (supabase as any)
        .from("students")
        .select(`
          id,
          student_id,
          name,
          gender,
          class_name
        `)
        .or(`name.ilike.%${cleanSearchTerm}%,student_id.ilike.%${cleanSearchTerm}%`)
        .eq("is_active", true)
        .order('name')
        .limit(20);

      if (error) throw error;
      
      const formattedStudents = data?.map(student => ({
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        gender: student.gender || "",
        class_name: student.class_name || "Belum Ditentukan"
      })) || [];
      
      setStudents(formattedStudents);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data siswa",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setSearchValue("");
    setSearchOpen(false);
    setAttendanceStatus("");
    setNotes("");
    // Update recent students list
    setRecentStudents(prev => {
      const filtered = prev.filter(s => s.id !== student.id);
      return [student, ...filtered].slice(0, 5);
    });
  };

  const clearSelection = () => {
    setSelectedStudent(null);
    setSearchValue("");
    setAttendanceStatus("");
    setNotes("");
    setShowRecentStudents(true);
  };

  const saveAttendance = async () => {
    if (!selectedStudent || !selectedDate || !attendanceStatus) {
      toast({
        title: "Error",
        description: "Lengkapi semua data yang diperlukan",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase as any)
        .from("attendance")
        .upsert({
          student_id: selectedStudent.id,
          date: selectedDate,
          status: attendanceStatus,
          notes: notes || null
        }, {
          onConflict: "student_id,date"
        });

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }
      
      toast({
        title: "Berhasil",
        description: `Berhasil menyimpan absensi untuk ${selectedStudent.name}`,
      });
      
      // Reset form
      setSelectedStudent(null);
      setSearchValue("");
      setAttendanceStatus("");
      setNotes("");
      setShowRecentStudents(true);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast({
        title: "Error",
        description: `Gagal menyimpan data absensi: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedStudent(null);
    setSearchValue("");
  };

  useEffect(() => {
    loadRecentStudents();
  }, []);

  useEffect(() => {
    if (searchValue.length > 0) {
      setShowRecentStudents(false);
      fetchStudents(searchValue);
    } else {
      setStudents([]);
      setShowRecentStudents(true);
    }
  }, [searchValue]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="max-w-2xl mx-auto p-3 sm:p-4 lg:p-6">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-4 sm:pb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg">
                  <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl font-bold text-slate-800">
                    Form Absensi Siswa
                  </CardTitle>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    {getDayName(selectedDate)},{' '}
                    {new Date(selectedDate).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-600 self-start sm:self-auto">
                <Clock className="h-4 w-4" />
                <span className="text-xs sm:text-sm font-medium">
                  {new Date().toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-700 font-medium">
                  Tanggal
                </Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border-slate-300"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Hari</Label>
                <Input
                  value={getDayName(selectedDate)}
                  readOnly
                  className="bg-slate-50 border-slate-300"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700 font-medium text-sm sm:text-base">
                Pilih Siswa
              </Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-between border-slate-300 h-10 sm:h-11 text-left font-normal text-sm sm:text-base"
                  >
                    {selectedStudent ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-4 w-4 text-slate-500 flex-shrink-0" />
                        <span className="truncate">
                          {selectedStudent.name} - {selectedStudent.student_id}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 min-w-0">
                        <Search className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          Cari siswa berdasarkan nama atau NIS...
                        </span>
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Ketik NIS atau nama siswa..."
                      value={searchValue}
                      onValueChange={setSearchValue}
                      className="h-11"
                    />
                    <CommandList className="max-h-[250px] sm:max-h-[300px]">
                      {isSearching && (
                        <div className="flex items-center justify-center py-6">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
                        </div>
                      )}

                      {!isSearching && showRecentStudents && recentStudents.length > 0 && (
                        <CommandGroup heading="Siswa Terbaru">
                          {recentStudents.map((student) => (
                            <CommandItem
                              key={student.id}
                              value={`${student.name} ${student.student_id}`}
                              onSelect={() => handleStudentSelect(student)}
                              className="cursor-pointer touch-manipulation p-3 sm:p-2"
                            >
                              <div className="flex items-center justify-between w-full min-w-0">
                                <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                                  <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-800 text-sm sm:text-base truncate">
                                      {student.name}
                                    </div>
                                    <div className="text-xs sm:text-sm text-slate-500 truncate">
                                      NIS: {student.student_id} • {student.class_name}
                                    </div>
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs flex-shrink-0 ml-2">
                                  {student.gender}
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Attendance Status */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium text-sm sm:text-base">Status Kehadiran</Label>
              <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
                <SelectTrigger className="border-slate-300 h-10 sm:h-11 text-sm sm:text-base">
                  <SelectValue placeholder="Pilih status kehadiran" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} className="text-sm sm:text-base">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium text-sm sm:text-base">Keterangan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan keterangan atau alasan status kehadiran (opsional)"
                className="min-h-[80px] sm:min-h-[100px] border-slate-300 resize-none text-sm sm:text-base"
              />
              <p className="text-xs text-slate-500">
                Contoh: Demam tinggi, Ke dokter, Acara keluarga, dll.
              </p>
            </div>

            {/* Selected Student Info */}
            {selectedStudent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
                    <span className="font-medium text-green-800 text-sm sm:text-base">Siswa Terpilih</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearSelection}
                    className="text-green-700 hover:text-green-900 hover:bg-green-100 h-6 px-2 text-xs sm:text-sm"
                  >
                    Ganti Siswa
                  </Button>
                </div>
                <div className="space-y-1 text-xs sm:text-sm">
                  <div><span className="font-medium">Nama:</span> {selectedStudent.name}</div>
                  <div><span className="font-medium">NIS:</span> {selectedStudent.student_id}</div>
                  <div><span className="font-medium">Kelas:</span> {selectedStudent.class_name}</div>
                  <div><span className="font-medium">Jenis Kelamin:</span> {selectedStudent.gender}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
              >
                Batal
              </Button>
              <Button 
                onClick={saveAttendance} 
                disabled={loading || !selectedStudent || !attendanceStatus}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 h-10 sm:h-11 text-sm sm:text-base touch-manipulation"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm sm:text-base">Menyimpan...</span>
                  </div>
                ) : (
                  "Simpan Absensi"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}