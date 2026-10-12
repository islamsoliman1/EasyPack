#!/bin/sh
set -eu
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 --set app_password="$APP_DB_PASSWORD" <<'SQL'
CREATE ROLE easyback LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
SELECT format('ALTER ROLE easyback PASSWORD %L', :'app_password') \gexec
ALTER DATABASE easyback OWNER TO easyback;
ALTER SCHEMA public OWNER TO easyback;
SQL
