-- Create storage bucket for logos if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to the logos bucket
CREATE POLICY "Public Access" ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

-- Allow authenticated users to upload to their own folder
CREATE POLICY "User Upload Access" ON storage.objects FOR INSERT
TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);
