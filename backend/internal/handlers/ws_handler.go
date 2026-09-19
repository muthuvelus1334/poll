package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"
	"live-polling-backend/internal/websocket"

	"github.com/gin-gonic/gin"
)

type WsHandler struct {
	hub         *websocket.Hub
	voteService *services.VoteService
}

func NewWsHandler(hub *websocket.Hub, voteService *services.VoteService) *WsHandler {
	return &WsHandler{
		hub:         hub,
		voteService: voteService,
	}
}

func (h *WsHandler) HandleWebSocket(c *gin.Context) {
	pollID := c.Param("id")
	if pollID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Poll ID is required"})
		return
	}

	conn, err := websocket.Upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	room := h.hub.GetOrCreateRoom(pollID)
	client := &websocket.Client{
		Hub:  h.hub,
		Room: room,
		Conn: conn,
		Send: make(chan []byte, 64),
	}

	room.Register <- client

	// Send immediate initial poll state to newly connected client
	go func() {
		initialResult, err := h.voteService.GetLiveResults(c.Request.Context(), pollID)
		if err == nil {
			initMsg := models.WsMessage{
				Type:    "init",
				Payload: initialResult,
			}
			data, _ := json.Marshal(initMsg)
			select {
			case client.Send <- data:
			default:
			}
		}
	}()

	go client.WritePump()
	go client.ReadPump()
}
