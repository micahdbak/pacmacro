// socket.go

package api

import (
	"fmt"
	"net/http"
	"sync"
	"encoding/json"
	ws "github.com/gorilla/websocket"
)

type Conn struct {
	c     *ws.Conn
	coord Coordinate
	id    string
}

type Sockets struct {
	// private
	players *Players
	conn    []*Conn // active connections; nil if broken
	mutex   sync.Mutex
}

func (s *Sockets) Init(players *Players) {
	s.players = players

	fmt.Print("Sockets handler initialized.\n")
}

func (s *Sockets) Find(id string) *Conn {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for _, conn := range s.conn {
		if conn == nil {
			continue
		}

		if conn.id == id {
			return conn
		}
	}

	return nil
}

func (s *Sockets) Inform(id string) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	p := s.players.Get(id)
	if p == nil {
		return // player doesn't exist
	}

	var msg Message
	for _, conn := range s.conn {
		// was disconnected
		if conn == nil {
			continue
		}

		if conn.id == id {
			msg.Coord = conn.coord
		}
	}
	msg.Command = CMD_INFORM
	msg.Data = p.Format(id)

	msg_json, err := json.Marshal(msg)
	if err != nil {
		return
	}

	// for every connection
	for _, conn := range s.conn {
		if conn == nil {
			continue
		}

		// inform
		conn.c.WriteMessage(ws.TextMessage, msg_json)
	}
}

func (s *Sockets) Informs() []string {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	var ret []string

	for _, conn := range s.conn {
		// disconnected
		if conn == nil {
			continue
		}

		p := s.players.Get(conn.id)
		// invalid connection
		if p == nil {
			continue
		}

		var msg Message
		msg.Coord = conn.coord
		msg.Command = CMD_INFORM
		msg.Data = p.Format(conn.id)

		msg_json, err := json.Marshal(msg)
		if err != nil {
			continue
		}

		ret = append(ret, string(msg_json))
	}

	return ret
}

// move a player; notify connections
func (s *Sockets) Move(conn_i int, coord Coordinate) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	conn := s.conn[conn_i]
	conn.coord = coord

	var msg Message
	msg.Coord   = coord
	msg.Command = CMD_MOVE
	msg.Data    = conn.id

	msg_json, err := json.Marshal(msg)
	if err != nil {
		return // failure
	}

	// for every connection
	for _, conn := range s.conn {
		// check if unactive
		if conn == nil {
			continue
		}

		// send update message
		conn.c.WriteMessage(ws.TextMessage, msg_json)
	}
}

func (s *Sockets) Connect(c *ws.Conn, id string) int {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	p := s.players.Get(id)
	if p == nil {
		return -1 // player doesn't exist
	}

	var conn *Conn
	conn = new(Conn)
	conn.c = c
	conn.id = id
	conn_i := -1

	// iterate over active connections
	for i, _ := range s.conn {
		if s.conn[i] == nil {
			s.conn[i] = conn
			conn_i = i
			break
		}
	}

	// if there are no empty spaces; append
	if conn_i == -1 {
		conn_i = len(s.conn)
		s.conn = append(s.conn, conn)
	}

	return conn_i
}

func (s *Sockets) Disconnect(conn_i int) {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	s.conn[conn_i] = nil
}

// WS /api/ws/<ID>
func (s *Sockets) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	ID := r.URL.Path[8:]
	player := s.players.Get(ID)
	if player == nil {
		http.Error(w,
			http.StatusText(http.StatusBadRequest),
			http.StatusBadRequest)
		return
	}

	// attempt to upgrade connection to websocket connection
	conn, err := Upgrader.Upgrade(w, r, nil)
	if err != nil {
		http.Error(w,
			http.StatusText(http.StatusBadRequest),
			http.StatusBadRequest)
		return
	}
	defer conn.Close()

	// attempt to log in
	msgType, msg, err := conn.ReadMessage()
	if err != nil || msgType != ws.TextMessage || !player.Login(string(msg)) {
		//fmt.Printf("Sockets\tServeHTTP (/api/ws/):\tID %q: Bad password.\n", ID)
		return
	}

	// add connection
	conn_i := s.Connect(conn, ID)
	if conn_i == -1 {
		return // error
	}
	defer s.Disconnect(conn_i)

	fmt.Printf("Sockets\tServeHTTP (/api/ws/):\tID %q: Connection opened.\n", ID)

	// inform new connection of existing connections
	informs := s.Informs()
	for _, msg := range informs {
		conn.WriteMessage(ws.TextMessage, []byte(msg))
	}

	// let existing connections know about this player
	s.Inform(ID)

	s.players.SetStatus(ID, StatusConn)
	defer s.players.SetStatus(ID, StatusDisc)

	// hold connection open; receive location information
	for {
		// receive message from connection
		msgType, msg, err := conn.ReadMessage()
		// check if either the connection failed or was closed
		if err != nil || msgType == ws.CloseMessage {
			fmt.Printf("Sockets\tServeHTTP (/api/ws/):\tID %q: Connection closed", ID)

			if err != nil {
				fmt.Printf(": %v.\n", err)
			} else {
				fmt.Print(" by user.")
			}

			// exit loop; close goroutine
			break
		}

		var coord Coordinate
		if err := json.Unmarshal(msg, &coord); err != nil {
			continue
		}

		s.Move(conn_i, coord)
	}

	// on disconnect, tell everyone you moved to 0.0, 0.0, so you disappear from the map
	var coord Coordinate
	coord.Latitude = 0.0
	coord.Longitude = 0.0
	s.Move(conn_i, coord);
}
