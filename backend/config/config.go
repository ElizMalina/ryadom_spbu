package config

import (
	"os"
	"strings"
)

type Config struct {
	HTTPAddr                   string
	CORSAllowedOrigins         string
	DatabaseURL                string
	AuthCookieSecure           bool
	AuthBootstrapAdminUsername string
	AuthBootstrapAdminPassword string
}

func FromEnv() Config {
	return Config{
		AuthCookieSecure:           !strings.EqualFold(os.Getenv("AUTH_COOKIE_SECURE"), "false"),
		AuthBootstrapAdminUsername: os.Getenv("AUTH_BOOTSTRAP_ADMIN_USERNAME"),
		AuthBootstrapAdminPassword: os.Getenv("AUTH_BOOTSTRAP_ADMIN_PASSWORD"),
		HTTPAddr:                   envOrDefault("HTTP_ADDR", ":8080"),
		CORSAllowedOrigins:         envOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:3000"),
		DatabaseURL:                envOrDefault("DATABASE_URL", "postgres://ryadom:ryadom@localhost:5432/ryadom?sslmode=disable"),
	}
}

func envOrDefault(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}
