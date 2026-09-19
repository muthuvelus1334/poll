package handlers

import (
	"net/http"

	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"
	"live-polling-backend/internal/websocket"

	"github.com/gin-gonic/gin"
)

type PollHandler struct {
	pollService *services.PollService
	hub         *websocket.Hub
}

func NewPollHandler(pollService *services.PollService, hub *websocket.Hub) *PollHandler {
	return &PollHandler{
		pollService: pollService,
		hub:         hub,
	}
}

func (h *PollHandler) CreatePoll(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Validation failed: " + err.Error()})
		return
	}

	poll, err := h.pollService.CreatePoll(c.Request.Context(), userID.(string), req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, poll)
}

func (h *PollHandler) GetPoll(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	poll, err := h.pollService.GetPoll(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, poll)
}

func (h *PollHandler) ListMyPolls(c *gin.Context) {
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	polls, err := h.pollService.ListUserPolls(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, polls)
}

type UpdateStatusRequest struct {
	IsActive bool `json:"isActive"`
}

func (h *PollHandler) SetPollStatus(c *gin.Context) {
	pollID := c.Param("id")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	poll, err := h.pollService.SetPollStatus(c.Request.Context(), pollID, userID.(string), req.IsActive)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Broadcast status update to all connected live viewers via WebSocket
	if h.hub != nil {
		h.hub.BroadcastPollStatus(pollID, req.IsActive)
	}

	c.JSON(http.StatusOK, poll)
}

func (h *PollHandler) DeletePoll(c *gin.Context) {
	pollID := c.Param("id")
	userID, exists := c.Get("userID")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	err := h.pollService.DeletePoll(c.Request.Context(), pollID, userID.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Poll deleted successfully"})
}
