-- Migration to support dynamic class creation from Excel import
-- This allows classes to be created automatically when importing student data

-- First, let's ensure the classes table exists with the right structure
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  grade_level INTEGER,
  section TEXT,
  academic_year TEXT DEFAULT '2024/2025',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create students table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  class_id UUID REFERENCES public.classes(id),
  gender TEXT NOT NULL CHECK (gender IN ('Laki-laki', 'Perempuan')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create attendance table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.attendance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES public.students(id),
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Hadir', 'Sakit', 'Izin', 'Alpha')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- Create policies for classes
CREATE POLICY "Classes are viewable by everyone" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Classes are insertable by everyone" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "Classes are updatable by everyone" ON public.classes FOR UPDATE USING (true);

-- Create policies for students
CREATE POLICY "Students are viewable by everyone" ON public.students FOR SELECT USING (true);
CREATE POLICY "Students are insertable by everyone" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "Students are updatable by everyone" ON public.students FOR UPDATE USING (true);

-- Create policies for attendance
CREATE POLICY "Attendance is viewable by everyone" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Attendance is insertable by everyone" ON public.attendance FOR INSERT WITH CHECK (true);
CREATE POLICY "Attendance is updatable by everyone" ON public.attendance FOR UPDATE USING (true);

-- Create function to update updated_at column if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_classes_updated_at ON public.classes;
CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON public.students;
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_attendance_updated_at ON public.attendance;
CREATE TRIGGER update_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default classes if they don't exist
INSERT INTO public.classes (name, grade_level, section, academic_year) VALUES
  ('7A', 7, 'A', '2024/2025'),
  ('7B', 7, 'B', '2024/2025'),
  ('7C', 7, 'C', '2024/2025'),
  ('8A', 8, 'A', '2024/2025'),
  ('8B', 8, 'B', '2024/2025'),
  ('8C', 8, 'C', '2024/2025'),
  ('9A', 9, 'A', '2024/2025'),
  ('9B', 9, 'B', '2024/2025'),
  ('9C', 9, 'C', '2024/2025')
ON CONFLICT (name) DO NOTHING;

-- Create function to automatically create class if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_or_create_class(class_name TEXT)
RETURNS UUID AS $$
DECLARE
  class_id UUID;
  grade_num INTEGER;
  section_char TEXT;
BEGIN
  -- First try to find existing class
  SELECT id INTO class_id FROM public.classes WHERE name = class_name;
  
  IF class_id IS NOT NULL THEN
    RETURN class_id;
  END IF;
  
  -- Extract grade level and section from class name (e.g., "7A" -> grade=7, section="A")
  grade_num := CASE 
    WHEN class_name ~ '^[789]' THEN SUBSTRING(class_name FROM '^([789])')::INTEGER
    ELSE NULL
  END;
  
  section_char := CASE 
    WHEN class_name ~ '[A-Z]$' THEN RIGHT(class_name, 1)
    ELSE NULL
  END;
  
  -- Create new class
  INSERT INTO public.classes (name, grade_level, section, academic_year)
  VALUES (class_name, grade_num, section_char, '2024/2025')
  RETURNING id INTO class_id;
  
  RETURN class_id;
END;
$$ LANGUAGE plpgsql;
