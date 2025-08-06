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
  { value: "present", label: "Hadir" },
  { value: "excused", label: "Izin" },
  { value: "sick", label: "Sakit" },
  { value: "absent", label: "Alpha" },
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
    if (debouncedSearchValue.length > 1) {
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
      const { data, error } = await supabase
        .from("attendance")
        .select(`
          students!inner(
            id,
            student_id,
            name,
            gender,
            classes!inner(name)
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
        class_name: record.students.classes?.name || ""
      })) || [];
      
      // Remove duplicates based on student ID
      const uniqueStudents = formattedStudents.filter((student, index, self) => 
        index === self.findIndex(s => s.id === student.id)
      );
      
      setRecentStudents(uniqueStudents);
    } catch (error) {
      console.error("Error loading recent students:", error);
    }
  };

  const fetchStudents = async (searchTerm: string) => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from("students")
        .select(`
          id,
          student_id,
          name,
          gender,
          classes!inner(name)
        `)
        .or(`name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`)
        .eq("is_active", true)
        .order('name')
        .limit(15); // Increased limit for better search results

      if (error) throw error;
      
      const formattedStudents = data?.map(student => ({
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        gender: student.gender || "",
        class_name: (student as any).classes?.name || ""
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
    setSearchValue(`${student.name} (${student.student_id})`);
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
      const { error } = await supabase
        .from("attendance")
        .upsert({
          student_id: selectedStudent.id,
          date: selectedDate,
          status: attendanceStatus,
          notes: notes || null,
          recorded_by: "admin"
        }, {
          onConflict: "student_id,date"
        });

      if (error) throw error;
      
      toast({
        title: "Berhasil",
        description: "Berhasil menyimpan absensi",
      });
      
      // Reset form
      setSelectedStudent(null);
      setSearchValue("");
      setAttendanceStatus("");
      setNotes("");
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast({
        title: "Error",
        description: "Gagal menyimpan data absensi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedStudent(null);
    setSearchValue("");
    setAttendanceStatus("");
    setNotes("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" className="text-slate-600">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Input Absensi Siswa</h1>
            <p className="text-sm text-slate-600">SMPN 2 Kebakkramat</p>
          </div>
        </div>

        {/* Form Card */}
        <Card className="shadow-lg border-0">
          <CardHeader className="bg-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-slate-700">
              <div className="w-5 h-5 bg-blue-600 rounded"></div>
              Form Absensi Harian
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* Date and Day */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-slate-700 font-medium">Tanggal</Label>
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

            {/* Student Search */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Nomor Induk Siswa (NIS)</Label>
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={searchOpen}
                    className="w-full justify-start border-slate-300 h-11"
                  >
                    <Search className="mr-2 h-4 w-4 text-slate-400" />
                    {searchValue || "Ketik NIS atau nama siswa..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Cari siswa..." 
                      value={searchValue}
                      onValueChange={setSearchValue}
                      className="h-11"
                    />
                    <CommandList>
                      <CommandEmpty>
                        {isSearching ? 'Mencari...' : 'Siswa tidak ditemukan.'}
                      </CommandEmpty>
                      <CommandGroup>
                        {students.map((student) => (
                          <CommandItem
                            key={student.id}
                            value={`${student.student_id} ${student.name}`}
                            onSelect={() => handleStudentSelect(student)}
                            className="flex flex-col items-start p-3"
                          >
                            <div className="font-medium">{student.name}</div>
                            <div className="text-sm text-slate-600">
                              NIS: {student.student_id} • {student.class_name} • {student.gender}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Attendance Status */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Status Kehadiran</Label>
              <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
                <SelectTrigger className="border-slate-300 h-11">
                  <SelectValue placeholder="Pilih status kehadiran" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium">Keterangan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Masukkan keterangan atau alasan status kehadiran (opsional)"
                className="min-h-[100px] border-slate-300 resize-none"
              />
              <p className="text-xs text-slate-500">
                Contoh: Demam tinggi, Ke dokter, Acara keluarga, dll.
              </p>
            </div>

            {/* Selected Student Info */}
            {selectedStudent && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Siswa Terpilih</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Nama:</span> {selectedStudent.name}</div>
                  <div><span className="font-medium">NIS:</span> {selectedStudent.student_id}</div>
                  <div><span className="font-medium">Kelas:</span> {selectedStudent.class_name}</div>
                  <div><span className="font-medium">Jenis Kelamin:</span> {selectedStudent.gender}</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button 
                variant="outline" 
                onClick={handleCancel}
                className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </Button>
              <Button 
                onClick={saveAttendance} 
                disabled={loading || !selectedStudent || !attendanceStatus}
                className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:opacity-50"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Menyimpan...
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