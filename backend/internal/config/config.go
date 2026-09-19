package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port         string
	MongoURI     string
	MongoDBName  string
	RedisURI     string
	RedisPass    string
	JWTSecret    string
	ClientOrigin string
}

func LoadConfig() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	port := getEnv("PORT", "8080")
	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	mongoDBName := getEnv("MONGO_DB_NAME", "live_polling_db")
	redisURI := getEnv("REDIS_URI", "")
	if redisURI == "" {
		redisURI = getEnv("REDIS_URL", "localhost:6379")
	}
	redisPass := getEnv("REDIS_PASSWORD", "")
	jwtSecret := getEnv("JWT_SECRET", "super-secure-jwt-secret-key-change-in-production-2026")
	clientOrigin := getEnv("CLIENT_ORIGIN", "*")

	return &Config{
		Port:         port,
		MongoURI:     mongoURI,
		MongoDBName:  mongoDBName,
		RedisURI:     redisURI,
		RedisPass:    redisPass,
		JWTSecret:    jwtSecret,
		ClientOrigin: clientOrigin,
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists && value != "" {
		return value
	}
	return defaultValue
}
