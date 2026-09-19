package services

import (
	"context"
	"errors"
	"sync"
	"time"

	"live-polling-backend/internal/config"
	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	db        *mongo.Database
	cfg       *config.Config
	memUsers  map[string]models.User
	memMu     sync.RWMutex
}

func NewAuthService(clients *database.Clients, cfg *config.Config) *AuthService {
	var db *mongo.Database
	if clients != nil {
		db = clients.DB
	}
	return &AuthService{
		db:       db,
		cfg:      cfg,
		memUsers: make(map[string]models.User),
	}
}

func (s *AuthService) Register(ctx context.Context, req models.SignupRequest) (*models.AuthResponse, error) {
	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	newUser := models.User{
		ID:        primitive.NewObjectID(),
		Username:  req.Username,
		Email:     req.Email,
		Password:  string(hashedPassword),
		CreatedAt: time.Now(),
	}

	if s.db != nil {
		usersCol := s.db.Collection("users")
		// Check existing
		var existing models.User
		err = usersCol.FindOne(ctx, bson.M{"email": req.Email}).Decode(&existing)
		if err == nil {
			return nil, errors.New("user with this email already exists")
		}

		_, err = usersCol.InsertOne(ctx, newUser)
		if err != nil {
			return nil, errors.New("failed to create user account")
		}
	} else {
		// In-memory fallback
		s.memMu.Lock()
		for _, u := range s.memUsers {
			if u.Email == req.Email {
				s.memMu.Unlock()
				return nil, errors.New("user with this email already exists")
			}
		}
		s.memUsers[newUser.ID.Hex()] = newUser
		s.memMu.Unlock()
	}

	token, err := s.generateToken(newUser)
	if err != nil {
		return nil, err
	}

	resp := &models.AuthResponse{
		Token: token,
	}
	resp.User.ID = newUser.ID.Hex()
	resp.User.Username = newUser.Username
	resp.User.Email = newUser.Email

	return resp, nil
}

func (s *AuthService) Login(ctx context.Context, req models.LoginRequest) (*models.AuthResponse, error) {
	var user models.User

	if s.db != nil {
		usersCol := s.db.Collection("users")
		err := usersCol.FindOne(ctx, bson.M{"email": req.Email}).Decode(&user)
		if err != nil {
			return nil, errors.New("invalid email or password")
		}
	} else {
		s.memMu.RLock()
		found := false
		for _, u := range s.memUsers {
			if u.Email == req.Email {
				user = u
				found = true
				break
			}
		}
		s.memMu.RUnlock()
		if !found {
			return nil, errors.New("invalid email or password")
		}
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, err
	}

	resp := &models.AuthResponse{
		Token: token,
	}
	resp.User.ID = user.ID.Hex()
	resp.User.Username = user.Username
	resp.User.Email = user.Email

	return resp, nil
}

func (s *AuthService) generateToken(user models.User) (string, error) {
	claims := jwt.MapClaims{
		"sub":      user.ID.Hex(),
		"username": user.Username,
		"email":    user.Email,
		"exp":      time.Now().Add(7 * 24 * time.Hour).Unix(),
		"iat":      time.Now().Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.cfg.JWTSecret))
}
