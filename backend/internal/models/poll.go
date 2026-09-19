package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Option struct {
	ID         string  `bson:"id" json:"id"`
	Text       string  `bson:"text" json:"text"`
	Votes      int64   `bson:"votes" json:"votes"`
	Percentage float64 `bson:"-" json:"percentage"`
}

type Poll struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	Title       string             `bson:"title" json:"title"`
	Description string             `bson:"description" json:"description"`
	CreatorID   primitive.ObjectID `bson:"creatorId" json:"creatorId"`
	Options     []Option           `bson:"options" json:"options"`
	IsActive    bool               `bson:"isActive" json:"isActive"`
	TotalVotes  int64              `bson:"totalVotes" json:"totalVotes"`
	CreatedAt   time.Time          `bson:"createdAt" json:"createdAt"`
	ClosedAt    *time.Time         `bson:"closedAt,omitempty" json:"closedAt,omitempty"`
}

type CreatePollRequest struct {
	Title       string   `json:"title" binding:"required,min=3,max=300"`
	Description string   `json:"description" binding:"max=1000"`
	Options     []string `json:"options" binding:"required,min=2,max=10,dive,min=1,max=200"`
}

type VoteRequest struct {
	OptionID         string `json:"optionId" binding:"required"`
	VoterFingerprint string `json:"voterFingerprint"`
}

type LivePollResult struct {
	PollID     string   `json:"pollId"`
	Title      string   `json:"title"`
	IsActive   bool     `json:"isActive"`
	TotalVotes int64    `json:"totalVotes"`
	Options    []Option `json:"options"`
	Viewers    int      `json:"viewers"`
}

type WsMessage struct {
	Type    string      `json:"type"` // "init", "vote_update", "status_change", "viewer_count", "error"
	Payload interface{} `json:"payload"`
}
