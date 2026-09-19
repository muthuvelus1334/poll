package services

import (
	"context"
	"testing"

	"live-polling-backend/internal/models"
)

func TestCreatePollValidation(t *testing.T) {
	pollService := NewPollService(nil)

	// Test case 1: insufficient options
	req := models.CreatePollRequest{
		Title:   "Invalid Poll",
		Options: []string{"Only One"},
	}
	_, err := pollService.CreatePoll(context.Background(), "user1", req)
	if err == nil {
		t.Errorf("Expected error for poll with less than 2 options, got nil")
	}

	// Test case 2: duplicate options
	dupReq := models.CreatePollRequest{
		Title:   "Duplicate Options Poll",
		Options: []string{"Option A", "option a"},
	}
	_, err = pollService.CreatePoll(context.Background(), "user1", dupReq)
	if err == nil {
		t.Errorf("Expected error for duplicate options, got nil")
	}

	// Test case 3: valid poll creation
	validReq := models.CreatePollRequest{
		Title:   "What is your favorite language?",
		Options: []string{"Go", "JavaScript", "Python"},
	}
	poll, err := pollService.CreatePoll(context.Background(), "user1", validReq)
	if err != nil {
		t.Fatalf("Unexpected error for valid poll: %v", err)
	}
	if len(poll.Options) != 3 {
		t.Errorf("Expected 3 options, got %d", len(poll.Options))
	}
	if !poll.IsActive {
		t.Errorf("Expected new poll to be active")
	}
}

func TestVoteDuplicatePrevention(t *testing.T) {
	pollService := NewPollService(nil)
	voteService := NewVoteService(nil, pollService)

	// Create a poll
	poll, err := pollService.CreatePoll(context.Background(), "user1", models.CreatePollRequest{
		Title:   "Realtime Test Poll",
		Options: []string{"Yes", "No"},
	})
	if err != nil {
		t.Fatalf("Failed to create poll: %v", err)
	}

	pollID := poll.ID.Hex()
	optID := poll.Options[0].ID

	// First vote should succeed
	result, err := voteService.CastVote(context.Background(), pollID, models.VoteRequest{
		OptionID:         optID,
		VoterFingerprint: "voter-abc-123",
	}, "127.0.0.1")
	if err != nil {
		t.Fatalf("First vote failed: %v", err)
	}
	if result.TotalVotes != 1 {
		t.Errorf("Expected total votes to be 1, got %d", result.TotalVotes)
	}

	// Second vote from same voter should be rejected
	_, err = voteService.CastVote(context.Background(), pollID, models.VoteRequest{
		OptionID:         optID,
		VoterFingerprint: "voter-abc-123",
	}, "127.0.0.1")
	if err == nil {
		t.Errorf("Expected second vote from same voter to be rejected, but it succeeded")
	}
}
