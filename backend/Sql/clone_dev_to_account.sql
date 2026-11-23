-- Dev tool, run manually in Supabase SQL Editor. Not part of EF migrations.
-- Copies the dev user's library (UserWorks, UserArtists) to another account; existing entries are skipped.
-- Usage: SELECT * FROM clone_dev_to_account('<user-id>');

CREATE OR REPLACE FUNCTION public.clone_dev_to_account(target_user_id uuid)
RETURNS TABLE (works_copied int, artists_copied int)
LANGUAGE plpgsql
AS $$
DECLARE
    dev_user_id constant uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
    IF target_user_id = dev_user_id THEN
        RAISE EXCEPTION 'Target is the dev user';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM "Users" WHERE "Id" = target_user_id) THEN
        RAISE EXCEPTION 'User % not found', target_user_id;
    END IF;

    INSERT INTO "UserWorks" ("UserId", "WorkId", "Status", "AddedAt", "UpdatedAt")
    SELECT target_user_id, "WorkId", "Status", "AddedAt", "UpdatedAt"
    FROM "UserWorks"
    WHERE "UserId" = dev_user_id
    ON CONFLICT ("UserId", "WorkId") DO NOTHING;
    GET DIAGNOSTICS works_copied = ROW_COUNT;

    INSERT INTO "UserArtists" ("UserId", "ArtistId", "Status", "Note", "AddedAt", "UpdatedAt")
    SELECT target_user_id, "ArtistId", "Status", "Note", "AddedAt", "UpdatedAt"
    FROM "UserArtists"
    WHERE "UserId" = dev_user_id
    ON CONFLICT ("UserId", "ArtistId") DO NOTHING;
    GET DIAGNOSTICS artists_copied = ROW_COUNT;

    RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.clone_dev_to_account(uuid) FROM PUBLIC, anon, authenticated;