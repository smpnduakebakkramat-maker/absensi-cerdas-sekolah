import { useState, useEffect, useRef } from "react";
import { Users, Plus, Upload, Edit, Trash2, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  student_id: string;
  name: string;
  class_name: string;
  gender: string;
  is_active: boolean;
}

// Get unique class names from students
const getUniqueClasses = (students: Student[]): string[] => {
  const classNames = students
    .filter(s => s.class_name && s.is_active)
    .map(s => s.class_name);
  return [...new Set(classNames)].sort();
};

const DataSiswa = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Enhanced Excel import with validation preview
  const [importPreview, setImportPreview] = useState<{
    validStudents: any[];
    errors: string[];
    duplicates: any[];
    showPreview: boolean;
  }>({ validStudents: [], errors: [], duplicates: [], showPreview: false });
  const [importProgress, setImportProgress] = useState(0);
  const [formData, setFormData] = useState({
    student_id: "",
    name: "",
    class_name: "",
    gender: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('students')
        .select('*')
        .order('name');

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: "Error",
        description: "Gagal memuat data siswa",
        variant: "destructive",
      });
    }
  };

  const handleSaveStudent = async () => {
    try {
      if (editingStudent) {
        const { error } = await (supabase as any)
          .from('students')
          .update(formData)
          .eq('id', editingStudent.id);
        
        if (error) throw error;
        toast({ title: "Berhasil", description: "Data siswa berhasil diupdate" });
      } else {
        const { error } = await (supabase as any)
          .from('students')
          .insert([formData]);
        
        if (error) throw error;
        toast({ title: "Berhasil", description: "Siswa baru berhasil ditambahkan" });
      }
      
      setIsAddDialogOpen(false);
      setEditingStudent(null);
      setFormData({
        student_id: "",
        name: "",
        class_name: "",
        gender: ""
      });
      fetchStudents();
    } catch (error) {
      console.error('Error saving student:', error);
      toast({
        title: "Error",
        description: "Gagal menyimpan data siswa",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('students')
        .update({ is_active: false })
        .eq('id', studentId);
      
      if (error) throw error;
      toast({ title: "Berhasil", description: "Siswa berhasil dinonaktifkan" });
      fetchStudents();
    } catch (error) {
      console.error('Error deleting student:', error);
      toast({
        title: "Error",
        description: "Gagal menghapus siswa",
        variant: "destructive",
      });
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClass === "all" || student.class_name === selectedClass;
    return matchesSearch && matchesClass && student.is_active;
  });

  const uniqueClasses = getUniqueClasses(students);

  const openEditDialog = (student: Student) => {
    setEditingStudent(student);
    setFormData({
      student_id: student.student_id,
      name: student.name,
      class_name: student.class_name,
      gender: student.gender
    });
    setIsAddDialogOpen(true);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: "Format File Tidak Valid",
        description: "File harus berformat Excel (.xlsx atau .xls)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File Terlalu Besar",
        description: "Ukuran file maksimal 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(10);
    
    try {
      const data = await file.arrayBuffer();
      setImportProgress(30);
      
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      setImportProgress(50);

      const headers = jsonData[0] as string[];
      const expectedHeaders = ['NIS', 'Nama Lengkap', 'Kelas', 'Jenis Kelamin'];
      const headerValid = expectedHeaders.every((header, index) => 
        headers[index]?.toString().toLowerCase().includes(header.toLowerCase())
      );

      if (!headerValid) {
        toast({
          title: "Format Header Salah",
          description: "Header harus: NIS, Nama Lengkap, Kelas, Jenis Kelamin",
          variant: "destructive",
        });
        return;
      }

      const rows = jsonData.slice(1) as any[][];
      const validStudents = [];
      const errors = [];
      const duplicates = [];
      let processedRows = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        const [nis, name, className, gender] = row;
        const rowNumber = i + 2;
        
        const validationErrors = [];
        
        if (!nis || nis.toString().trim() === '') {
          validationErrors.push('NIS kosong');
        } else if (!/^\d+$/.test(nis.toString().trim())) {
          validationErrors.push('NIS harus berupa angka');
        }
        
        if (!name || name.toString().trim() === '') {
          validationErrors.push('Nama kosong');
        } else if (name.toString().trim().length < 2) {
          validationErrors.push('Nama terlalu pendek');
        }
        
        if (!className || className.toString().trim() === '') {
          validationErrors.push('Kelas kosong');
        }
        
        if (!gender || !['Laki-laki', 'Perempuan', 'L', 'P'].includes(gender.toString().trim())) {
          validationErrors.push('Jenis kelamin harus "Laki-laki" atau "Perempuan"');
        }

        if (validationErrors.length > 0) {
          errors.push(`Baris ${rowNumber}: ${validationErrors.join(', ')}`);
          continue;
        }

        const normalizedGender = gender.toString().trim() === 'L' ? 'Laki-laki' : 
                                gender.toString().trim() === 'P' ? 'Perempuan' : 
                                gender.toString().trim();

        const classNameTrimmed = className.toString().trim();

        const duplicateInCurrent = validStudents.find(s => s.student_id === nis.toString().trim());
        if (duplicateInCurrent) {
          errors.push(`Baris ${rowNumber}: NIS "${nis}" duplikat dalam file`);
          continue;
        }

        const existingStudent = students.find(s => s.student_id === nis.toString().trim());
        if (existingStudent) {
          duplicates.push({
            rowNumber,
            student_id: nis.toString().trim(),
            name: name.toString().trim(),
            existing_name: existingStudent.name,
            className: classNameTrimmed
          });
          continue;
        }

        validStudents.push({
          rowNumber,
          student_id: nis.toString().trim(),
          name: name.toString().trim(),
          className: classNameTrimmed,
          gender: normalizedGender,
          is_active: true
        });
        
        processedRows++;
        setImportProgress(50 + (processedRows / rows.length) * 30);
      }

      setImportProgress(90);

      setImportPreview({
        validStudents,
        errors,
        duplicates,
        showPreview: true
      });

      setImportProgress(100);

    } catch (error) {
      console.error('Error processing Excel file:', error);
      toast({
        title: "Error",
        description: "Gagal memproses file Excel. Pastikan format file benar.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmImport = async (handleDuplicates: 'skip' | 'update' = 'skip') => {
    setIsImporting(true);
    
    try {
      let studentsToProcess = [...importPreview.validStudents];
      
      // Handle duplicate updates
      if (handleDuplicates === 'update' && importPreview.duplicates.length > 0) {
        for (const duplicate of importPreview.duplicates) {
          const existingStudent = students.find(s => s.student_id === duplicate.student_id);
          if (existingStudent) {
            try {
              const { error } = await (supabase as any)
                .from('students')
                .update({
                  name: duplicate.name,
                  class_name: duplicate.className,
                  gender: duplicate.gender
                })
                .eq('id', existingStudent.id);
              
              if (error) throw error;
            } catch (error) {
              console.error('Error updating duplicate student:', error);
              toast({
                title: "Error",
                description: `Gagal mengupdate siswa ${duplicate.name}`,
                variant: "destructive",
              });
            }
          }
        }
      }

      // Process new students
      if (studentsToProcess.length > 0) {
        const studentsToInsert = studentsToProcess.map(student => ({
          student_id: student.student_id,
          name: student.name,
          class_name: student.className,
          gender: student.gender,
          is_active: student.is_active
        }));
        
        const { error } = await (supabase as any)
          .from('students')
          .insert(studentsToInsert);

        if (error) throw error;
      }

      const totalProcessed = studentsToProcess.length + 
        (handleDuplicates === 'update' ? importPreview.duplicates.length : 0);

      toast({
        title: "Import Berhasil",
        description: `${totalProcessed} siswa berhasil diproses`,
      });

      // Refresh data
      await fetchStudents();
      setImportPreview({ validStudents: [], errors: [], duplicates: [], showPreview: false });

    } catch (error) {
      console.error('Error importing students:', error);
      toast({
        title: "Error",
        description: "Gagal mengimport data siswa",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['NIS', 'Nama Lengkap', 'Kelas', 'Jenis Kelamin'],
      ['12345', 'Ahmad Rizki', '7A', 'Laki-laki'],
      ['12346', 'Siti Nurhaliza', '7B', 'Perempuan'],
      ['12347', 'Budi Santoso', '8A', 'Laki-laki'],
      ['12348', 'Dewi Sartika', '8B', 'Perempuan'],
      ['12349', 'Andi Pratama', '9A', 'Laki-laki'],
      ['12350', 'Maya Sari', '9C', 'Perempuan'],
      ['', '', '', ''],
      ['PETUNJUK PENGISIAN:', '', '', ''],
      ['1. NIS: Nomor Induk Siswa (harus angka)', '', '', ''],
      ['2. Nama Lengkap: Nama siswa (minimal 2 karakter)', '', '', ''],
      ['3. Kelas: Nama kelas (contoh: 7A, 8B, 9C)', '', '', ''],
      ['   - Kelas akan dibuat otomatis jika belum ada', '', '', ''],
      ['4. Jenis Kelamin: Laki-laki atau Perempuan', '', '', ''],
      ['   - Bisa juga menggunakan L atau P', '', '', ''],
      ['', '', '', ''],
      ['CATATAN PENTING:', '', '', ''],
      ['- Pastikan format header sesuai dengan template', '', '', ''],
      ['- Hapus baris petunjuk ini sebelum import', '', '', ''],
      ['- Maksimal ukuran file 5MB', '', '', ''],
      ['- Format file harus .xlsx atau .xls', '', '', '']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 15 }, // NIS
      { wch: 25 }, // Nama Lengkap
      { wch: 10 }, // Kelas
      { wch: 15 }  // Jenis Kelamin
    ];
    ws['!cols'] = colWidths;
    
    // Style the header row
    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "366092" } },
      alignment: { horizontal: "center" }
    };
    
    // Apply header styling
    ['A1', 'B1', 'C1', 'D1'].forEach(cell => {
      if (ws[cell]) {
        ws[cell].s = headerStyle;
      }
    });
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Data Siswa");
    XLSX.writeFile(wb, "template_data_siswa_smpn3kebakkramat.xlsx");

    toast({
      title: "Template Berhasil Diunduh",
      description: "Template Excel dengan petunjuk lengkap telah didownload",
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader className="bg-gradient-to-r from-education-primary/10 to-education-secondary/10 border-b border-education-secondary/20">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-6 w-6 text-education-secondary" />
              Manajemen Data Siswa
            </CardTitle>
            <CardDescription>
              Kelola data siswa SMPN 3 KEBAKKRAMAT dengan fitur lengkap
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari nama atau NIS siswa..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Semua kelas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kelas</SelectItem>
                  {uniqueClasses.map(className => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx,.xls"
                  className="hidden"
                  aria-label="Upload Excel file for student data import"
                />
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                >
                  <Upload className="h-4 w-4" />
                  {isImporting ? "Mengimport..." : "Import Excel"}
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 border-education-primary/20 text-education-primary hover:bg-education-primary/10"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  Template
                </Button>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-education-primary to-education-secondary hover:from-education-primary/90 hover:to-education-secondary/90 text-white">
                      <Plus className="h-4 w-4 mr-2" />
                      Tambah Siswa
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>
                        {editingStudent ? "Edit Data Siswa" : "Tambah Siswa Baru"}
                      </DialogTitle>
                      <DialogDescription>
                        Lengkapi formulir di bawah ini untuk {editingStudent ? "mengupdate" : "menambahkan"} data siswa
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="student_id">NIS</Label>
                        <Input
                          id="student_id"
                          value={formData.student_id}
                          onChange={(e) => setFormData({...formData, student_id: e.target.value})}
                          placeholder="Nomor Induk Siswa"
                        />
                      </div>
                      <div>
                        <Label htmlFor="name">Nama Lengkap</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({...formData, name: e.target.value})}
                          placeholder="Nama lengkap siswa"
                        />
                      </div>
                      <div>
                        <Label htmlFor="class_name">Kelas</Label>
                        <Input
                          id="class_name"
                          value={formData.class_name}
                          onChange={(e) => setFormData({...formData, class_name: e.target.value})}
                          placeholder="Nama kelas (contoh: 7A, 8B, 9C)"
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">Jenis Kelamin</Label>
                        <Select value={formData.gender} onValueChange={(value) => setFormData({...formData, gender: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih jenis kelamin" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Laki-laki">Laki-laki</SelectItem>
                            <SelectItem value="Perempuan">Perempuan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsAddDialogOpen(false);
                          setEditingStudent(null);
                        }}
                      >
                        Batal
                      </Button>
                      <Button onClick={handleSaveStudent}>
                        {editingStudent ? "Update" : "Simpan"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Import Preview Dialog */}
            <Dialog open={importPreview.showPreview} onOpenChange={(open) => 
              setImportPreview(prev => ({ ...prev, showPreview: open }))
            }>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5 text-education-primary" />
                    Preview Import Data
                  </DialogTitle>
                  <DialogDescription>
                    Tinjau data yang akan diimport sebelum menyimpan ke database
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6">
                  {/* Import Summary */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {importPreview.validStudents.length}
                          </div>
                          <div className="text-sm text-green-700">Data Valid</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-yellow-200 bg-yellow-50">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-yellow-600">
                            {importPreview.duplicates.length}
                          </div>
                          <div className="text-sm text-yellow-700">Duplikat</div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card className="border-red-200 bg-red-50">
                      <CardContent className="p-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {importPreview.errors.length}
                          </div>
                          <div className="text-sm text-red-700">Error</div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Valid Students */}
                  {importPreview.validStudents.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-green-700">
                        Data Valid ({importPreview.validStudents.length})
                      </h3>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <div className="grid gap-2 p-3">
                          {importPreview.validStudents.map((student, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded border">
                              <div>
                                <span className="font-medium">{student.name}</span>
                                <span className="text-sm text-muted-foreground ml-2">({student.student_id})</span>
                              </div>
                              <div className="flex gap-2">
                                <Badge variant="secondary">{student.className}</Badge>
                                <Badge variant="outline">{student.gender}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Duplicates */}
                  {importPreview.duplicates.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-yellow-700">
                        Data Duplikat ({importPreview.duplicates.length})
                      </h3>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <div className="grid gap-2 p-3">
                          {importPreview.duplicates.map((duplicate, index) => (
                            <div key={index} className="p-2 bg-yellow-50 rounded border">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-medium">{duplicate.name}</span>
                                  <span className="text-sm text-muted-foreground ml-2">({duplicate.student_id})</span>
                                </div>
                                <Badge variant="secondary">{duplicate.className}</Badge>
                              </div>
                              <div className="text-xs text-yellow-700 mt-1">
                                Sudah ada: {duplicate.existing_name}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Errors */}
                  {importPreview.errors.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-red-700">
                        Error ({importPreview.errors.length})
                      </h3>
                      <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <div className="grid gap-1 p-3">
                          {importPreview.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-600 p-2 bg-red-50 rounded">
                              {error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setImportPreview(prev => ({ ...prev, showPreview: false }))}
                  >
                    Batal
                  </Button>
                  
                  {importPreview.duplicates.length > 0 && (
                    <Button
                      variant="outline"
                      onClick={() => confirmImport('update')}
                      disabled={isImporting}
                      className="border-yellow-500 text-yellow-700 hover:bg-yellow-50"
                    >
                      {isImporting ? "Memproses..." : "Import & Update Duplikat"}
                    </Button>
                  )}
                  
                  {importPreview.validStudents.length > 0 && (
                    <Button
                      onClick={() => confirmImport('skip')}
                      disabled={isImporting}
                      className="bg-gradient-to-r from-education-primary to-education-secondary hover:from-education-primary/90 hover:to-education-secondary/90"
                    >
                      {isImporting ? "Memproses..." : `Import ${importPreview.validStudents.length} Siswa`}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Progress indicator during import */}
            {isImporting && importProgress > 0 && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <Card className="p-6 min-w-80">
                  <div className="text-center space-y-4">
                    <Upload className="h-8 w-8 mx-auto text-education-primary animate-pulse" />
                    <div>
                      <div className="text-lg font-semibold">Memproses File Excel</div>
                      <div className="text-sm text-muted-foreground">Mohon tunggu...</div>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-education-primary to-education-secondary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${importProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-sm text-muted-foreground">{importProgress}%</div>
                  </div>
                </Card>
              </div>
            )}

            {/* Students Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  Daftar Siswa ({filteredStudents.length})
                </h3>
              </div>
              
              <div className="grid gap-4">
                {filteredStudents.map(student => (
                  <Card key={student.id} className="border border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-lg">{student.name}</h4>
                            <Badge variant="secondary">
                              {student.class_name || "Kelas tidak ditemukan"}
                            </Badge>
                            <Badge variant={student.gender === "Laki-laki" ? "default" : "outline"}>
                              {student.gender}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p><strong>NIS:</strong> {student.student_id}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(student)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteStudent(student.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredStudents.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Tidak ada siswa yang ditemukan</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default DataSiswa;