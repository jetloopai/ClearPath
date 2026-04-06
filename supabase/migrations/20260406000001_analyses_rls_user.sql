-- Allow authenticated users to read and update their own saved analyses
-- (Public/unauthenticated reads still go through the service role key server-side)

CREATE POLICY "Users can read own analyses"
ON analyses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own analyses"
ON analyses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
