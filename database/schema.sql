CREATE USER bangbang PASSWORD 'abcd123';

GRANT ALL PRIVILEGES ON DATABASE "staging-db" TO bangbang;

CREATE TABLE IF NOT EXISTS gaia_try_monitor
(
  hg_id character(40) NOT NULL,
  upstream json NOT NULL,
  state char(15) NOT NULL,
  CONSTRAINT gaia_try_monitor_pkey PRIMARY KEY (hg_id)
)
WITH (
  OIDS=FALSE
);
ALTER TABLE gaia_try_monitor OWNER TO bangbang;
