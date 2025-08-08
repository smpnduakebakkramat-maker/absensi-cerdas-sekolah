import { useState, useEffect, useMemo, useRef } from "react";
import { Search, ArrowLeft, Clock, User, CheckCircle, ClipboardList, UserCheck, UserX, Heart, AlertTriangle } from "lucide-react";
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
  { value: "Hadir", label: "Hadir", icon: UserCheck, color: "text-green-600" },
  { value: "Izin", label: "Izin", icon: User, color: "text-blue-600" },
  { value: "Sakit", label: "Sakit", icon: Heart, color: "text-yellow-600" },
  { value: "Alpha", label: "Alpha", icon: UserX, color: "text-red-600" },
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
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debouncedSearchValue = useDebounce(searchValue, 150); // Faster debounce
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (debouncedSearchValue.length > 0) {
      fetchStudents(debouncedSearchValue);
    } else {
      setStudents([]);
    }
  }, [debouncedSearchValue]);

  // Focus search input when popover opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

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
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Ketik nama atau NIS siswa..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-10 border-slate-300 h-11 text-sm"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-600"></div>
                    </div>
                  )}
                </div>
                
                {/* Search Results */}
                {searchValue && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {isSearching ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-600"></div>
                      </div>
                    ) : (
                      <>
                        {students.length > 0 && (
                          <div>
                            <div className="px-3 py-2 text-xs font-medium text-slate-500 bg-slate-50 border-b">
                              Hasil Pencarian ({students.length})
                            </div>
                            {students.map((student) => (
                              <button
                                key={student.id}
                                onClick={() => handleStudentSelect(student)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-gradient-to-br from-green-100 to-green-200 rounded-full flex items-center justify-center flex-shrink-0">
                                    <User className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium text-slate-800 text-sm truncate">
                                      {student.name}
                                    </div>
                                    <div className="text-xs text-slate-500 truncate">
                                      NIS: {student.student_id} • {student.class_name}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-xs flex-shrink-0">
                                    {student.gender}
                                  </Badge>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {!isSearching && searchValue && students.length === 0 && (
                          <div className="px-3 py-6 text-center text-slate-500 text-sm">
                            Tidak ada siswa yang ditemukan untuk "{searchValue}"
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
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

            {/* Attendance Status */}
            <div className="space-y-2">
              <Label className="text-slate-700 font-medium text-sm sm:text-base">Status Kehadiran</Label>
              <Select value={attendanceStatus} onValueChange={setAttendanceStatus}>
                <SelectTrigger className="border-slate-300 h-10 sm:h-11 text-sm sm:text-base">
                  <SelectValue placeholder="Pilih status kehadiran" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value} className="text-sm sm:text-base">
                        <div className="flex items-center gap-2">
                          <IconComponent className={`h-4 w-4 ${option.color}`} />
                          {option.label}
                        </div>
                      </SelectItem>
                    );
                  })}
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