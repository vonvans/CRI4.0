package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/redis/go-redis/v9"
)

var client *redis.Client

func init() {
	client = redis.NewClient(&redis.Options{
		Addr: fmt.Sprintf("%s:%s", os.Getenv("COLLECTORDB_HOST"), "6379"),
	})
}

type Data struct {
	Hostname  string   `json:"hostname"`
	Timestamp int      `json:"timestamp"`
	CPU       CPU      `json:"cpu"`
	RAM       RAM      `json:"ram"`
	Network   Network  `json:"network"`
	IO        IO       `json:"io"`
	Services  Services `json:"services"`
}

type CPU struct {
	Last1Min  float64 `json:"last1min"`
	Last5Min  float64 `json:"last5min"`
	Last15Min float64 `json:"last15min"`
}

type RAM struct {
	Total     int `json:"total"`
	Used      int `json:"used"`
	Free      int `json:"free"`
	Available int `json:"available"`
}

type Network struct {
	Received int `json:"received"`
	Sent     int `json:"sent"`
}

type IO struct {
	Read  int `json:"read"`
	Write int `json:"write"`
}

type Services struct {
	Webserver string   `json:"webserver"`
	Database  Database `json:"database"`
}

type Database struct {
	SQLInjection string `json:"sqlinjection"`
}

func enableCors(w *http.ResponseWriter) {
	(*w).Header().Set("Access-Control-Allow-Origin", "http://localhost:1212")
}

func main() {
	fmt.Println("App Starting...")
	http.HandleFunc("/collect", handler)
	log.Fatal(http.ListenAndServe(":80", nil))
}

func handler(w http.ResponseWriter, r *http.Request) {
	enableCors(&w)
	switch r.Method {
	case "GET":
		hostname := r.URL.Query().Get("hostname")
		if hostname == "" {
			http.Error(w, "Hostname is required", http.StatusBadRequest)
			return
		}

		ctx := context.Background()
		vals, err := client.LRange(ctx, hostname, 0, -1).Result()
		if err != nil {
			http.Error(w, "Error retrieving data from Redis", http.StatusInternalServerError)
			return
		}

		var dataArray []Data
		for _, val := range vals {
			var data Data
			err := json.Unmarshal([]byte(val), &data)
			if err != nil {
				continue
			}
			dataArray = append(dataArray, data)
		}

		responseJSON, err := json.Marshal(dataArray)
		if err != nil {
			http.Error(w, "Error encoding JSON", http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.Write(responseJSON)
	case "POST":
		var data Data
		err := json.NewDecoder(r.Body).Decode(&data)
		if err != nil {
			http.Error(w, "Invalid JSON", http.StatusBadRequest)
			return
		}

		var hostname = data.Hostname

		ctx := context.Background()
		dataJSON, err := json.Marshal(data)
		if err != nil {
			http.Error(w, "Error encoding JSON", http.StatusInternalServerError)
			return
		}

		err = client.LPush(ctx, hostname, dataJSON, 0).Err()
		if err != nil {
			http.Error(w, "Error storing data in Redis", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Success"))
	default:
		http.Error(w, "Invalid request method.", http.StatusMethodNotAllowed)
		return
	}
}
