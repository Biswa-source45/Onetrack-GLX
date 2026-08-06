package main

import (
	"context"
	"fmt"
	"log"

	"github.com/jackc/pgx/v5"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()
	dsn := "host=localhost port=5433 user=postgres password=postgres dbname=onetrack sslmode=disable"
	conn, err := pgx.Connect(context.Background(), dsn)
	if err != nil {
		log.Fatalf("Failed to connect: %v", err)
	}
	defer conn.Close(context.Background())

	sql := `
		TRUNCATE TABLE public.alerts CASCADE;
		TRUNCATE TABLE bid.bid_stage_history CASCADE;
		TRUNCATE TABLE bid.bid_checklists CASCADE;
		TRUNCATE TABLE bid.bid_workspace_members CASCADE;
		TRUNCATE TABLE bid.bid_workspaces CASCADE;
	`
	_, err = conn.Exec(context.Background(), sql)
	if err != nil {
		log.Fatalf("Failed to truncate: %v", err)
	}
	fmt.Println("SUCCESS: Fully purged all tender records and associated relations.")
}
