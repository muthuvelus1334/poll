package handlers

import (
	"net/http"

	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"

	"github.com/gin-gonic/gin"
)

type VoteHandler struct {
	voteService *services.VoteService
}

func NewVoteHandler(voteService *services.VoteService) *VoteHandler {
	return &VoteHandler{
		voteService: voteService,
	}
}

func (h *VoteHandler) CastVote(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Option ID is required"})
		return
	}

	// Capture client IP and any fingerprint header
	clientIP := c.ClientIP()
	if headerFP := c.GetHeader("X-Voter-Fingerprint"); headerFP != "" && req.VoterFingerprint == "" {
		req.VoterFingerprint = headerFP
	}

	result, err := h.voteService.CastVote(c.Request.Context(), pollID, req, clientIP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *VoteHandler) GetLiveResults(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	result, err := h.voteService.GetLiveResults(c.Request.Context(), pollID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}
