package websocket

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"live-polling-backend/internal/models"
	"live-polling-backend/internal/services"

	"github.com/redis/go-redis/v9"
)

type Room struct {
	PollID     string
	Clients    map[*Client]bool
	Register   chan *Client
	Unregister chan *Client
	Broadcast  chan []byte
	CancelSub  context.CancelFunc
}

type Hub struct {
	rooms       map[string]*Room
	mu          sync.RWMutex
	voteService *services.VoteService
	redis       *redis.Client
}

func NewHub(voteService *services.VoteService) *Hub {
	return &Hub{
		rooms:       make(map[string]*Room),
		voteService: voteService,
		redis:       voteService.GetRedis(),
	}
}

func (h *Hub) GetOrCreateRoom(pollID string) *Room {
	h.mu.Lock()
	defer h.mu.Unlock()

	if room, exists := h.rooms[pollID]; exists {
		return room
	}

	room := &Room{
		PollID:     pollID,
		Clients:    make(map[*Client]bool),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Broadcast:  make(chan []byte, 32),
	}

	h.rooms[pollID] = room
	go h.runRoom(room)

	return room
}

func (h *Hub) runRoom(room *Room) {
	ctx, cancel := context.WithCancel(context.Background())
	room.CancelSub = cancel

	// Start Redis Pub/Sub listener for this poll
	go h.listenRedisPubSub(ctx, room)

	// Also listen to in-memory local subscriber if Redis is offline
	localCh, unsubscribe := h.voteService.SubscribeLocal(room.PollID)
	defer unsubscribe()

	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case res, ok := <-localCh:
				if !ok {
					return
				}
				msg := models.WsMessage{
					Type:    "vote_update",
					Payload: res,
				}
				data, _ := json.Marshal(msg)
				room.Broadcast <- data
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		case client := <-room.Register:
			room.Clients[client] = true
			h.broadcastViewerCount(room)
		case client := <-room.Unregister:
			if _, ok := room.Clients[client]; ok {
				delete(room.Clients, client)
				close(client.Send)
				h.broadcastViewerCount(room)

				// Cleanup empty room after delay if nobody is watching
				if len(room.Clients) == 0 {
					go func(pID string) {
						time.Sleep(30 * time.Second)
						h.mu.Lock()
						if r, ok := h.rooms[pID]; ok && len(r.Clients) == 0 {
							r.CancelSub()
							delete(h.rooms, pID)
						}
						h.mu.Unlock()
					}(room.PollID)
				}
			}
		case message := <-room.Broadcast:
			for client := range room.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(room.Clients, client)
				}
			}
		}
	}
}

func (h *Hub) listenRedisPubSub(ctx context.Context, room *Room) {
	if h.redis == nil {
		return
	}

	channel := fmt.Sprintf("poll:%s:events", room.PollID)
	pubsub := h.redis.Subscribe(ctx, channel)
	defer pubsub.Close()

	ch := pubsub.Channel()
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				return
			}
			var liveResult models.LivePollResult
			if err := json.Unmarshal([]byte(msg.Payload), &liveResult); err == nil {
				wsMsg := models.WsMessage{
					Type:    "vote_update",
					Payload: liveResult,
				}
				data, _ := json.Marshal(wsMsg)
				room.Broadcast <- data
			}
		}
	}
}

func (h *Hub) broadcastViewerCount(room *Room) {
	count := len(room.Clients)
	msg := models.WsMessage{
		Type: "viewer_count",
		Payload: map[string]interface{}{
			"pollId":  room.PollID,
			"viewers": count,
		},
	}
	data, err := json.Marshal(msg)
	if err == nil {
		for client := range room.Clients {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}

func (h *Hub) BroadcastPollStatus(pollID string, isActive bool) {
	h.mu.RLock()
	room, exists := h.rooms[pollID]
	h.mu.RUnlock()

	if !exists {
		return
	}

	msgType := "poll_closed"
	if isActive {
		msgType = "poll_reopened"
	}

	msg := models.WsMessage{
		Type: msgType,
		Payload: map[string]interface{}{
			"pollId":   pollID,
			"isActive": isActive,
		},
	}
	data, err := json.Marshal(msg)
	if err == nil {
		room.Broadcast <- data
	}
}
