#!/bin/bash

set -e

dropdb gaia_try|| true
dropuser bangbang || true
createdb gaia_try
psql -c "CREATE USER bangbang password 'abcd123';"
psql -c "ALTER DATABASE gaia_try OWNER TO bangbang;"
psql -1 -d gaia_try -f schema.sql -U bangbang

echo DATABASE_URL=postgres://bangbang:abcd123@localhost:5432/gaia_try
