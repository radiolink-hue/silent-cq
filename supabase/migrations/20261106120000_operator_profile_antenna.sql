/*
  Remember the antenna chosen on the onboarding screen.
  Call Silent CQ reads it as the default and can still be changed for one post.
*/

ALTER TABLE operator_profiles
  ADD COLUMN IF NOT EXISTS antenna text;
