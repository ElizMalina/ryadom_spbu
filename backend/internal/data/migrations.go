package data

import _ "embed"

// InitialUp contains the initial schema and deterministic local development data.
//
//go:embed 000001_initial.up.sql
var InitialUp string

//go:embed 000003_auth.up.sql
var AuthUp string

//go:embed 000004_submissions.up.sql
var SubmissionsUp string
