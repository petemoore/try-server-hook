-- Should probably be creating indexes on submitted and completed
CREATE TABLE IF NOT EXISTS revisions
(
  id TEXT NOT NULL,  -- gaia-try commit id
  repository TEXT NOT NULL, -- gaia-try repository
  eventtype TEXT NOT NULL, -- was it a pull_request, push?
  prnum INTEGER DEFAULT NULL, -- if it's a PR, what's the number
  username TEXT NOT NULL, -- user who did the pushing/pr'ing
  basebranch TEXT NOT NULL,
  targetbranch TEXT NOT NULL,
  baseremote TEXT NOT NULL,
  targetremote TEXT NOT NULL,
  basecommit TEXT NOT NULL,
  targetcommit TEXT NOT NULL,
  commitmsg TEXT NOT NULL,
  upstream json NOT NULL, -- Various info mainly for debugging
  submitted timestamp NOT NULL, -- time of when gaia-try commit happend
  completed timestamp DEFAULT NULL, -- time when we found out job was done
  CONSTRAINT revisions_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);

CREATE TABLE IF NOT EXISTS builds
(
  id INTEGER NOT NULL,
  name TEXT NOT NULL,
  starttime TIMESTAMP,
  endtime TIMESTAMP,
  revision TEXT references revisions(id) ON DELETE CASCADE,
  outcome INTEGER DEFAULT NULL,
  CONSTRAINT builds_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
)
