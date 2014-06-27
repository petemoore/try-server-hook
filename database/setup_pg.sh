#!/bin/bash

set -e
createdb staging-db || true
psql -s staging-db -f database/schema

echo DATABASE_URL=postgres://bangbang:abcd123@localhost:5432/staging-db

