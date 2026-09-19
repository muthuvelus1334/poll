package services

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"

	"github.com/google/uuid"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type PollService struct {
	db       *mongo.Database
	memPolls map[string]models.Poll
	memMu    sync.RWMutex
}

func NewPollService(clients *database.Clients) *PollService {
	var db *mongo.Database
	if clients != nil {
		db = clients.DB
	}
	return &PollService{
		db:       db,
		memPolls: make(map[string]models.Poll),
	}
}

func (s *PollService) CreatePoll(ctx context.Context, creatorID string, req models.CreatePollRequest) (*models.Poll, error) {
	creatorObjID, err := primitive.ObjectIDFromHex(creatorID)
	if err != nil {
		// allow hex generation if needed
		creatorObjID = primitive.NewObjectID()
	}

	// Sanitize and validate options
	var options []models.Option
	seen := make(map[string]bool)

	for _, optText := range req.Options {
		trimmed := strings.TrimSpace(optText)
		if trimmed == "" {
			continue
		}
		lower := strings.ToLower(trimmed)
		if seen[lower] {
			return nil, fmt.Errorf("duplicate option: '%s'", trimmed)
		}
		seen[lower] = true

		options = append(options, models.Option{
			ID:         uuid.New().String()[:8],
			Text:       trimmed,
			Votes:      0,
			Percentage: 0,
		})
	}

	if len(options) < 2 {
		return nil, errors.New("a poll must have at least 2 distinct non-empty options")
	}

	newPoll := models.Poll{
		ID:          primitive.NewObjectID(),
		Title:       strings.TrimSpace(req.Title),
		Description: strings.TrimSpace(req.Description),
		CreatorID:   creatorObjID,
		Options:     options,
		IsActive:    true,
		TotalVotes:  0,
		CreatedAt:   time.Now(),
	}

	if s.db != nil {
		_, err := s.db.Collection("polls").InsertOne(ctx, newPoll)
		if err != nil {
			return nil, fmt.Errorf("failed to save poll: %w", err)
		}
	} else {
		s.memMu.Lock()
		s.memPolls[newPoll.ID.Hex()] = newPoll
		s.memMu.Unlock()
	}

	return &newPoll, nil
}

func (s *PollService) GetPoll(ctx context.Context, pollID string) (*models.Poll, error) {
	objID, err := primitive.ObjectIDFromHex(pollID)
	if err != nil {
		// Try in-memory fallback directly
		s.memMu.RLock()
		poll, exists := s.memPolls[pollID]
		s.memMu.RUnlock()
		if exists {
			s.calculatePercentages(&poll)
			return &poll, nil
		}
		return nil, errors.New("invalid poll ID format")
	}

	if s.db != nil {
		var poll models.Poll
		err := s.db.Collection("polls").FindOne(ctx, bson.M{"_id": objID}).Decode(&poll)
		if err != nil {
			return nil, errors.New("poll not found")
		}
		s.calculatePercentages(&poll)
		return &poll, nil
	}

	s.memMu.RLock()
	poll, exists := s.memPolls[pollID]
	s.memMu.RUnlock()
	if !exists {
		return nil, errors.New("poll not found")
	}
	s.calculatePercentages(&poll)
	return &poll, nil
}

func (s *PollService) ListUserPolls(ctx context.Context, userID string) ([]models.Poll, error) {
	objID, err := primitive.ObjectIDFromHex(userID)
	if err != nil && s.db != nil {
		return []models.Poll{}, nil
	}

	var results []models.Poll
	if s.db != nil {
		cursor, err := s.db.Collection("polls").Find(ctx, bson.M{"creatorId": objID})
		if err != nil {
			return nil, err
		}
		defer cursor.Close(ctx)

		if err = cursor.All(ctx, &results); err != nil {
			return nil, err
		}
	} else {
		s.memMu.RLock()
		for _, p := range s.memPolls {
			if p.CreatorID.Hex() == userID || userID == "" {
				results = append(results, p)
			}
		}
		s.memMu.RUnlock()
	}

	if results == nil {
		results = []models.Poll{}
	}

	for i := range results {
		s.calculatePercentages(&results[i])
	}

	return results, nil
}

func (s *PollService) SetPollStatus(ctx context.Context, pollID string, creatorID string, isActive bool) (*models.Poll, error) {
	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}

	if poll.CreatorID.Hex() != creatorID {
		return nil, errors.New("unauthorized: you do not own this poll")
	}

	poll.IsActive = isActive
	var closedAt *time.Time
	if !isActive {
		now := time.Now()
		closedAt = &now
	}
	poll.ClosedAt = closedAt

	if s.db != nil {
		update := bson.M{
			"$set": bson.M{
				"isActive": isActive,
				"closedAt": closedAt,
			},
		}
		objID, _ := primitive.ObjectIDFromHex(pollID)
		_, err = s.db.Collection("polls").UpdateOne(ctx, bson.M{"_id": objID}, update)
		if err != nil {
			return nil, err
		}
	} else {
		s.memMu.Lock()
		s.memPolls[pollID] = *poll
		s.memMu.Unlock()
	}

	s.calculatePercentages(poll)
	return poll, nil
}

func (s *PollService) DeletePoll(ctx context.Context, pollID string, creatorID string) error {
	poll, err := s.GetPoll(ctx, pollID)
	if err != nil {
		return err
	}

	if poll.CreatorID.Hex() != creatorID {
		return errors.New("unauthorized: you do not own this poll")
	}

	if s.db != nil {
		objID, _ := primitive.ObjectIDFromHex(pollID)
		_, err = s.db.Collection("polls").DeleteOne(ctx, bson.M{"_id": objID})
		return err
	}

	s.memMu.Lock()
	delete(s.memPolls, pollID)
	s.memMu.Unlock()
	return nil
}

func (s *PollService) UpdateVotesInDB(ctx context.Context, pollID string, optionVotes map[string]int64, totalVotes int64) error {
	if s.db != nil {
		objID, err := primitive.ObjectIDFromHex(pollID)
		if err != nil {
			return err
		}

		// Update option votes
		var poll models.Poll
		if err := s.db.Collection("polls").FindOne(ctx, bson.M{"_id": objID}).Decode(&poll); err != nil {
			return err
		}

		for i := range poll.Options {
			if count, ok := optionVotes[poll.Options[i].ID]; ok {
				poll.Options[i].Votes = count
			}
		}
		poll.TotalVotes = totalVotes

		_, err = s.db.Collection("polls").ReplaceOne(ctx, bson.M{"_id": objID}, poll)
		return err
	}

	s.memMu.Lock()
	if p, ok := s.memPolls[pollID]; ok {
		for i := range p.Options {
			if count, found := optionVotes[p.Options[i].ID]; found {
				p.Options[i].Votes = count
			}
		}
		p.TotalVotes = totalVotes
		s.memPolls[pollID] = p
	}
	s.memMu.Unlock()
	return nil
}

func (s *PollService) calculatePercentages(poll *models.Poll) {
	if poll.TotalVotes == 0 {
		for i := range poll.Options {
			poll.Options[i].Percentage = 0
		}
		return
	}

	for i := range poll.Options {
		poll.Options[i].Percentage = float64(poll.Options[i].Votes) / float64(poll.TotalVotes) * 100
	}
}
