// game.go

package api

import (
	"fmt"
	"net/http"
	"sync"
	"encoding/json"
)

type Game struct {
	// private
	players *Players
	mutex   sync.Mutex

	// public
	Min    Coordinate `json:"min"`
	Max    Coordinate `json:"max"`
	Width  uint64     `json:"width"`
	Height uint64     `json:"height"`
}

func (g *Game) Init(players *Players) {
	g.players = players

	// hardcoded coordinate values for SFU UniverCity
	// (matches the map used in the HTML)
	g.Min.Latitude = 49.27462710773634
	g.Min.Longitude = -122.91628624024605
	g.Max.Latitude = 49.28099313727333
	g.Max.Longitude = -122.90273076431673

	// coordinate size of map
	g.Width = 32
	g.Height = 32

	fmt.Print("Game handler initialized.\n")
}

// /api/game/*
func (g *Game) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path[10:]

	// GET /api/game/map.json
	if path == "map.json" {
		g.ServeMap(w, r)
	// /api/game/*
	} else {
		http.Error(w,
			http.StatusText(http.StatusNotFound),
			http.StatusNotFound)
	}
}

// GET /api/game/map.json
func (g *Game) ServeMap(w http.ResponseWriter, r *http.Request) {
	JSON, err := json.Marshal(g)
	if err != nil {
		http.Error(w,
			http.StatusText(http.StatusInternalServerError),
			http.StatusInternalServerError)
		return
	}

	w.Write(JSON)
}
