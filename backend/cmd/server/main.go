package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	authHandler "github.com/onetrack/backend/internal/auth/handler"
	authRepo "github.com/onetrack/backend/internal/auth/repository"
	authService "github.com/onetrack/backend/internal/auth/service"
	bidHandler "github.com/onetrack/backend/internal/bid/handler"
	bidRepo "github.com/onetrack/backend/internal/bid/repository"
	bidService "github.com/onetrack/backend/internal/bid/service"
	"github.com/onetrack/backend/internal/middleware"
	"github.com/onetrack/backend/internal/platform/config"
	"github.com/onetrack/backend/internal/platform/database"
	redisClient "github.com/onetrack/backend/internal/platform/redis"
	taskHandler "github.com/onetrack/backend/internal/task/handler"
	taskRepo "github.com/onetrack/backend/internal/task/repository"
	taskService "github.com/onetrack/backend/internal/task/service"
	userHandler "github.com/onetrack/backend/internal/user/handler"
	userRepo "github.com/onetrack/backend/internal/user/repository"
	userService "github.com/onetrack/backend/internal/user/service"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	ctx := context.Background()

	// Initialize PostgreSQL
	dbPool, err := database.NewPostgresPool(ctx, cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer dbPool.Close()
	log.Println("Connected to PostgreSQL")

	// Initialize Redis
	rdb, err := redisClient.NewRedisClient(ctx, cfg.Redis)
	if err != nil {
		log.Fatalf("Failed to connect to Redis: %v", err)
	}
	defer rdb.Close()
	log.Println("Connected to Redis")

	// Initialize services
	jwtSvc := authService.NewJWTService(cfg.JWT, rdb)
	authRepository := authRepo.NewPostgresAuthRepository(dbPool)
	authSvc := authService.NewAuthService(authRepository, jwtSvc)

	// Initialize middleware
	authMiddleware := middleware.NewAuthMiddleware(jwtSvc)

	// Initialize Gin
	gin.SetMode(cfg.Server.Mode)
	router := gin.Default()

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "healthy",
			"service": "onetrack-backend",
			"time":    time.Now().UTC().Format(time.RFC3339),
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")

	// Register auth routes
	authHdlr := authHandler.NewAuthHandler(authSvc)
	authHandler.RegisterAuthRoutes(v1, authHdlr, authMiddleware)

	// Initialize user module
	userRepository := userRepo.NewPostgresUserRepository(dbPool)
	userSvc := userService.NewUserService(userRepository)
	userHdlr := userHandler.NewUserHandler(userSvc)
	userHandler.RegisterUserRoutes(v1, userHdlr, authMiddleware)

	// Initialize bid module
	bidRepository := bidRepo.NewPostgresBidRepository(dbPool)
	bidSvc := bidService.NewBidService(bidRepository)
	bidHdlr := bidHandler.NewBidHandler(bidSvc)
	bidHandler.RegisterBidRoutes(v1, bidHdlr, authMiddleware)

	// Initialize task module (shared surface for MANUAL + INTELLIGENCE modes)
	taskRepository := taskRepo.NewPostgresTaskRepository(dbPool)
	taskSvc := taskService.NewTaskService(taskRepository)
	taskHdlr := taskHandler.NewTaskHandler(taskSvc)
	taskHandler.RegisterTaskRoutes(v1, taskHdlr, authMiddleware)

	// Start server
	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Server.Port),
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	go func() {
		log.Printf("Server starting on port %s", cfg.Server.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited gracefully")
}
