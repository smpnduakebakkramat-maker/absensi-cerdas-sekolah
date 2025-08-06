-- Drop the classes table completely
DROP TABLE IF EXISTS classes CASCADE;

-- Modify the students table to remove class_id foreign key and add class_name field
ALTER TABLE students 
  DROP COLUMN IF EXISTS class_id,
  ADD COLUMN class_name TEXT;

-- Update any existing students to have a default class name if needed
UPDATE students 
SET class_name = 'Belum Ditentukan' 
WHERE class_name IS NULL;