package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/database"
	"live-polling-backend/internal/handlers"
	"live-polling-backend/internal/middleware"
	"live-polling-backend/internal/services"
	"live-polling-backend/internal/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	// Connect to MongoDB and Redis
	dbClients, err := database.InitDatabases(cfg)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}

	// Initialize application services
	authService := services.NewAuthService(dbClients, cfg)
	pollService := services.NewPollService(dbClients)
	voteService := services.NewVoteService(dbClients, pollService)

	// Initialize WebSocket hub
	hub := websocket.NewHub(voteService)

	// Initialize HTTP handlers
	authHandler := handlers.NewAuthHandler(authService)
	pollHandler := handlers.NewPollHandler(pollService, hub)
	voteHandler := handlers.NewVoteHandler(voteService)
	wsHandler := handlers.NewWsHandler(hub, voteService)

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())
	router.Use(middleware.CORSMiddleware())

	// Health check endpoint
	router.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":    "healthy",
			"timestamp": time.Now().UTC(),
			"services": gin.H{
				"mongodb": dbClients.DB != nil,
				"redis":   dbClients.Redis != nil,
			},
		})
	})

	// Public Auth endpoints
	api := router.Group("/api")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Public Poll endpoints for audience voting & results
		api.GET("/polls/:id", pollHandler.GetPoll)
		api.POST("/polls/:id/vote", voteHandler.CastVote)
		api.GET("/polls/:id/results", voteHandler.GetLiveResults)
		api.GET("/polls/:id/ws", wsHandler.HandleWebSocket)

		// Protected routes for poll creators
		protected := api.Group("")
		protected.Use(middleware.AuthMiddleware(cfg))
		{
			protected.GET("/auth/me", authHandler.Me)
			protected.POST("/polls", pollHandler.CreatePoll)
			protected.GET("/polls", pollHandler.ListMyPolls)
			protected.PATCH("/polls/:id/status", pollHandler.SetPollStatus)
			protected.DELETE("/polls/:id", pollHandler.DeletePoll)
		}
	}

	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
	}

	// Run server in background goroutine
	go func() {
		log.Printf("Live Polling backend server running on port %s...", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown on SIGINT or SIGTERM
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	if dbClients.Mongo != nil {
		_ = dbClients.Mongo.Disconnect(shutdownCtx)
	}
	if dbClients.Redis != nil {
		_ = dbClients.Redis.Close()
	}

	log.Println("Server exited cleanly.")
}
