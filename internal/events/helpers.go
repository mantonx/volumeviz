package events

import (
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Helper functions for converting between map[string]string and []byte JSON

// labelsToJSON converts a map[string]string to JSON bytes
func labelsToJSON(labels map[string]string) []byte {
	if labels == nil {
		return nil
	}
	data, _ := json.Marshal(labels)
	return data
}

// stringToPgText converts a string to pgtype.Text
func stringToPgText(s string) pgtype.Text {
	return pgtype.Text{String: s, Valid: s != ""}
}

// boolToPgBool converts a bool to pgtype.Bool
func boolToPgBool(b bool) pgtype.Bool {
	return pgtype.Bool{Bool: b, Valid: true}
}

// pgBoolToBool converts a pgtype.Bool to bool
func pgBoolToBool(pb pgtype.Bool) bool {
	return pb.Valid && pb.Bool
}

// timeToPgTimestamptz converts a time.Time to pgtype.Timestamptz
func timeToPgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: !t.IsZero()}
}

// timePointerToPgTimestamptz converts a *time.Time to pgtype.Timestamptz
func timePointerToPgTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}
