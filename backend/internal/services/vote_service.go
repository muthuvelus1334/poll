package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strconv"
	"sync"
	"time"

	"live-polling-backend/internal/database"
	"live-polling-backend/internal/models"

	"github.com/redis/go-redis/v9"
)

type VoteService struct {
	redis       *redis.Client
	pollService *PollService

	// Resilient in-memory fallback for local dev when Redis is unavailable
	memVotes   map[string]map[string]int64
	memVoters  map[string]map[string]bool
	memMu      sync.RWMutex
	subscribers map[string][]chan models.LivePollResult
	subMu       sync.RWMutex
}

func NewVoteService(clients *database.Clients, pollService *PollService) *VoteService {
	var rdb *redis.Client
	if clients != nil {
		rdb = clients.Redis
	}

	return &VoteService{
		redis:       rdb,
		pollService: pollService,
		memVotes:    make(map[string]map[string]int64),
		memVoters:   make(map[string]map[string]bool),
		subscribers: make(map[string][]chan models.LivePollResult),
	}
}

// CastVote handles atomic voting, duplicate prevention, pub/sub notification, and database sync
func (s *VoteService) CastVote(ctx context.Context, pollID string, req models.VoteRequest, clientIP string) (*models.LivePollResult, error) {
	poll, err := s.pollService.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}

	if !poll.IsActive {
		return nil, errors.New("this poll is closed and no longer accepting votes")
	}

	// Validate option exists
	var optionValid bool
	for _, opt := range poll.Options {
		if opt.ID == req.OptionID {
			optionValid = true
			break
		}
	}
	if !optionValid {
		return nil, errors.New("invalid option selected for this poll")
	}

	// Voter identifier: combination of client-provided fingerprint and IP address
	voterKey := req.VoterFingerprint
	if voterKey == "" {
		voterKey = clientIP
	} else {
		voterKey = fmt.Sprintf("%s:%s", req.VoterFingerprint, clientIP)
	}

	// 1. Check duplicate voter in Redis Set: SADD poll:{id}:voters {voterKey}
	redisConnected := s.isRedisAvailable(ctx)
	if redisConnected {
		votersSetKey := fmt.Sprintf("poll:%s:voters", pollID)
		added, err := s.redis.SAdd(ctx, votersSetKey, voterKey).Result()
		if err != nil {
			log.Printf("Redis SAdd error: %v", err)
		} else if added == 0 {
			return nil, errors.New("you have already cast your vote on this poll")
		}

		// 2. Atomic increment: HINCRBY poll:{id}:votes {optionId} 1
		votesHashKey := fmt.Sprintf("poll:%s:votes", pollID)
		_, err = s.redis.HIncrBy(ctx, votesHashKey, req.OptionID, 1).Result()
		if err != nil {
			log.Printf("Redis HIncrBy error: %v", err)
		}

		// 3. Increment total votes: INCR poll:{id}:total
		totalKey := fmt.Sprintf("poll:%s:total", pollID)
		_, _ = s.redis.Incr(ctx, totalKey).Result()
	} else {
		// In-memory fallback if Redis is offline
		s.memMu.Lock()
		if s.memVoters[pollID] == nil {
			s.memVoters[pollID] = make(map[string]bool)
		}
		if s.memVoters[pollID][voterKey] {
			s.memMu.Unlock()
			return nil, errors.New("you have already cast your vote on this poll")
		}
		s.memVoters[pollID][voterKey] = true

		if s.memVotes[pollID] == nil {
			s.memVotes[pollID] = make(map[string]int64)
			// seed initial values from poll
			for _, o := range poll.Options {
				s.memVotes[pollID][o.ID] = o.Votes
			}
		}
		s.memVotes[pollID][req.OptionID]++
		s.memMu.Unlock()
	}

	// 4. Fetch updated live results
	liveResult, err := s.GetLiveResults(ctx, pollID)
	if err != nil {
		return nil, err
	}

	// 5. Publish to Redis Pub/Sub: PUBLISH poll:{id}:events <payload>
	if redisConnected {
		channel := fmt.Sprintf("poll:%s:events", pollID)
		payloadBytes, _ := json.Marshal(liveResult)
		if err := s.redis.Publish(ctx, channel, payloadBytes).Err(); err != nil {
			log.Printf("Redis Publish error: %v", err)
		}
	} else {
		// Broadcast to local memory channels
		s.broadcastLocal(pollID, *liveResult)
	}

	// 6. Asynchronously sync tally to MongoDB
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		optionMap := make(map[string]int64)
		for _, o := range liveResult.Options {
			optionMap[o.ID] = o.Votes
		}
		_ = s.pollService.UpdateVotesInDB(bgCtx, pollID, optionMap, liveResult.TotalVotes)
	}()

	return liveResult, nil
}

// GetLiveResults fetches active counts primarily from Redis, falling back to DB/mem
func (s *VoteService) GetLiveResults(ctx context.Context, pollID string) (*models.LivePollResult, error) {
	poll, err := s.pollService.GetPoll(ctx, pollID)
	if err != nil {
		return nil, err
	}

	var totalVotes int64
	optionVotes := make(map[string]int64)

	redisConnected := s.isRedisAvailable(ctx)
	if redisConnected {
		votesHashKey := fmt.Sprintf("poll:%s:votes", pollID)
		counts, err := s.redis.HGetAll(ctx, votesHashKey).Result()
		if err == nil && len(counts) > 0 {
			for optID, countStr := range counts {
				val, _ := strconv.ParseInt(countStr, 10, 64)
				optionVotes[optID] = val
				totalVotes += val
			}
		} else {
			// Seed Redis with current MongoDB counts
			for _, o := range poll.Options {
				if o.Votes > 0 {
					_ = s.redis.HSet(ctx, votesHashKey, o.ID, o.Votes).Err()
					optionVotes[o.ID] = o.Votes
					totalVotes += o.Votes
				}
			}
			if totalVotes > 0 {
				_ = s.redis.Set(ctx, fmt.Sprintf("poll:%s:total", pollID), totalVotes, 0).Err()
			}
		}
	} else {
		s.memMu.RLock()
		if counts, ok := s.memVotes[pollID]; ok {
			for k, v := range counts {
				optionVotes[k] = v
				totalVotes += v
			}
		} else {
			for _, o := range poll.Options {
				optionVotes[o.ID] = o.Votes
				totalVotes += o.Votes
			}
		}
		s.memMu.RUnlock()
	}

	// Construct result with percentages
	var updatedOptions []models.Option
	for _, o := range poll.Options {
		votes := optionVotes[o.ID]
		percentage := 0.0
		if totalVotes > 0 {
			percentage = float64(votes) / float64(totalVotes) * 100
		}
		updatedOptions = append(updatedOptions, models.Option{
			ID:         o.ID,
			Text:       o.Text,
			Votes:      votes,
			Percentage: percentage,
		})
	}

	return &models.LivePollResult{
		PollID:     pollID,
		Title:      poll.Title,
		IsActive:   poll.IsActive,
		TotalVotes: totalVotes,
		Options:    updatedOptions,
	}, nil
}

func (s *VoteService) isRedisAvailable(ctx context.Context) bool {
	if s.redis == nil {
		return false
	}
	pingCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
	defer cancel()
	return s.redis.Ping(pingCtx).Err() == nil
}

func (s *VoteService) SubscribeLocal(pollID string) (chan models.LivePollResult, func()) {
	ch := make(chan models.LivePollResult, 10)
	s.subMu.Lock()
	s.subscribers[pollID] = append(s.subscribers[pollID], ch)
	s.subMu.Unlock()

	unsubscribe := func() {
		s.subMu.Lock()
		defer s.subMu.Unlock()
		subs := s.subscribers[pollID]
		for i, c := range subs {
			if c == ch {
				s.subscribers[pollID] = append(subs[:i], subs[i+1:]...)
				close(ch)
				break
			}
		}
	}

	return ch, unsubscribe
}

func (s *VoteService) broadcastLocal(pollID string, data models.LivePollResult) {
	s.subMu.RLock()
	subs := append([]chan models.LivePollResult{}, s.subscribers[pollID]...)
	s.subMu.RUnlock()

	for _, ch := range subs {
		select {
		case ch <- data:
		default:
		}
	}
}

func (s *VoteService) GetRedis() *redis.Client {
	return s.redis
}
