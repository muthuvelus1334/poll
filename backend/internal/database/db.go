package database

import (
	"context"
	"log"
	"strings"
	"time"

	"live-polling-backend/internal/config"

	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Clients struct {
	Mongo   *mongo.Client
	DB      *mongo.Database
	Redis   *redis.Client
	UseMock bool
}

func InitDatabases(cfg *config.Config) (*Clients, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	log.Printf("Connecting to MongoDB at: %s", maskURI(cfg.MongoURI))
	mongoOpts := options.Client().ApplyURI(cfg.MongoURI).SetServerSelectionTimeout(10 * time.Second)
	mongoClient, err := mongo.Connect(ctx, mongoOpts)
	
	var db *mongo.Database
	var activeMongoClient *mongo.Client

	if err == nil && mongoClient != nil {
		if pingErr := mongoClient.Ping(ctx, nil); pingErr == nil {
			log.Println("Successfully connected to MongoDB")
			db = mongoClient.Database(cfg.MongoDBName)
			initMongoIndexes(ctx, db)
			activeMongoClient = mongoClient
		} else {
			log.Printf("MongoDB ping failed (%v). Fast in-memory fallback active.", pingErr)
		}
	} else {
		log.Printf("MongoDB connect failed. Fast in-memory fallback active.")
	}

	log.Printf("Connecting to Redis at: %s", cfg.RedisURI)
	var redisClient *redis.Client

	// Parse redis options
	if strings.HasPrefix(cfg.RedisURI, "redis://") || strings.HasPrefix(cfg.RedisURI, "rediss://") {
		opt, err := redis.ParseURL(cfg.RedisURI)
		if err != nil {
			log.Printf("Warning: Invalid Redis URL %s: %v", cfg.RedisURI, err)
		} else {
			redisClient = redis.NewClient(opt)
		}
	} else {
		redisClient = redis.NewClient(&redis.Options{
			Addr:     cfg.RedisURI,
			Password: cfg.RedisPass,
			DB:       0,
		})
	}

	var activeRedisClient *redis.Client
	if redisClient != nil {
		redisCtx, redisCancel := context.WithTimeout(context.Background(), 1*time.Second)
		defer redisCancel()

		if err := redisClient.Ping(redisCtx).Err(); err == nil {
			log.Println("Successfully connected to Redis")
			activeRedisClient = redisClient
		} else {
			log.Printf("Redis ping failed (%v). Fast in-memory Pub/Sub and atomic counter active.", err)
		}
	}

	return &Clients{
		Mongo: activeMongoClient,
		DB:    db,
		Redis: activeRedisClient,
	}, nil
}

func initMongoIndexes(ctx context.Context, db *mongo.Database) {
	usersCol := db.Collection("users")
	emailIndex := mongo.IndexModel{
		Keys:    bson.M{"email": 1},
		Options: options.Index().SetUnique(true),
	}
	_, _ = usersCol.Indexes().CreateOne(ctx, emailIndex)

	pollsCol := db.Collection("polls")
	creatorIndex := mongo.IndexModel{
		Keys: bson.M{"creatorId": 1},
	}
	_, _ = pollsCol.Indexes().CreateOne(ctx, creatorIndex)
}

func maskURI(uri string) string {
	if strings.Contains(uri, "@") {
		parts := strings.Split(uri, "@")
		return "mongodb+srv://****@" + parts[1]
	}
	return uri
}
