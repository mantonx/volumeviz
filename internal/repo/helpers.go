package repo

import (
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
)

// Helper functions for converting between domain types and pgtype

// String pointer to pgtype.Text
func stringPtrToPgText(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{Valid: false}
	}
	return pgtype.Text{String: *s, Valid: true}
}

// pgtype.Text to string pointer
func pgTextToStringPtr(pt pgtype.Text) *string {
	if !pt.Valid {
		return nil
	}
	return &pt.String
}

// Int32 pointer to pgtype.Int4
func int32PtrToPgInt4(i *int32) pgtype.Int4 {
	if i == nil {
		return pgtype.Int4{Valid: false}
	}
	return pgtype.Int4{Int32: *i, Valid: true}
}

// pgtype.Int4 to int32 pointer
func pgInt4ToInt32Ptr(pi pgtype.Int4) *int32 {
	if !pi.Valid {
		return nil
	}
	return &pi.Int32
}

// pgtype.Int4 to int32
func pgInt4ToInt32(pi pgtype.Int4) int32 {
	if !pi.Valid {
		return 0
	}
	return pi.Int32
}

// Int64 pointer to pgtype.Int8
func int64PtrToPgInt8(i *int64) pgtype.Int8 {
	if i == nil {
		return pgtype.Int8{Valid: false}
	}
	return pgtype.Int8{Int64: *i, Valid: true}
}

// pgtype.Int8 to int64 pointer
func pgInt8ToInt64Ptr(pi pgtype.Int8) *int64 {
	if !pi.Valid {
		return nil
	}
	return &pi.Int64
}

// pgtype.Int8 to int64
func pgInt8ToInt64(pi pgtype.Int8) int64 {
	if !pi.Valid {
		return 0
	}
	return pi.Int64
}

// Time pointer to pgtype.Timestamp
func timePtrToPgTimestamp(t *time.Time) pgtype.Timestamp {
	if t == nil {
		return pgtype.Timestamp{Valid: false}
	}
	return pgtype.Timestamp{Time: *t, Valid: true}
}

// pgtype.Timestamp to time pointer
func pgTimestampToTimePtr(pt pgtype.Timestamp) *time.Time {
	if !pt.Valid {
		return nil
	}
	return &pt.Time
}

// Bool to pgtype.Bool
func boolToPgBool(b bool) pgtype.Bool {
	return pgtype.Bool{Bool: b, Valid: true}
}

// pgtype.Bool to bool
func pgBoolToBool(pb pgtype.Bool) bool {
	if !pb.Valid {
		return false
	}
	return pb.Bool
}

// Bool pointer to pgtype.Bool
func boolPtrToPgBool(b *bool) pgtype.Bool {
	if b == nil {
		return pgtype.Bool{Valid: false}
	}
	return pgtype.Bool{Bool: *b, Valid: true}
}

// Time pointer to time.Time (with zero value for nil)
func timePtrToTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}

// time.Time to time pointer (with nil for zero value)
func timeToTimePtr(t time.Time) *time.Time {
	if t.IsZero() {
		return nil
	}
	return &t
}

// Float64 pointer to pgtype.Numeric
func float64PtrToPgNumeric(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{Valid: false}
	}
	// For now, convert to text representation
	// In a real implementation, you might use a proper big.Int conversion
	var numeric pgtype.Numeric
	numeric.Scan(*f) // Use the built-in conversion
	return numeric
}

// Time pointer to pgtype.Timestamptz
func timePtrToPgTimestamptz(t *time.Time) pgtype.Timestamptz {
	if t == nil {
		return pgtype.Timestamptz{Valid: false}
	}
	return pgtype.Timestamptz{Time: *t, Valid: true}
}

// pgtype.Text to string (for nullable strings)
func pgTextToString(pt pgtype.Text) string {
	if !pt.Valid {
		return ""
	}
	return pt.String
}

// Time to pgtype.Date
func timeToPgDate(t time.Time) pgtype.Date {
	return pgtype.Date{Time: t, Valid: true}
}

// pgtype.Date to time.Time
func pgDateToTime(pd pgtype.Date) time.Time {
	if !pd.Valid {
		return time.Time{}
	}
	return pd.Time
}

// Time to pgtype.Timestamptz
func timeToPgTimestamptz(t time.Time) pgtype.Timestamptz {
	return pgtype.Timestamptz{Time: t, Valid: true}
}

// pgtype.Timestamptz to time.Time
func pgTimestamptzToTime(pt pgtype.Timestamptz) time.Time {
	if !pt.Valid {
		return time.Time{}
	}
	return pt.Time
}

// pgtype.Timestamptz to time pointer
func pgTimestamptzToTimePtr(pt pgtype.Timestamptz) *time.Time {
	if !pt.Valid {
		return nil
	}
	return &pt.Time
}

// pgtype.Numeric to string
func pgNumericToString(pn pgtype.Numeric) string {
	if !pn.Valid {
		return ""
	}
	// Convert to float64 first
	var f64 float64
	pn.Scan(&f64)
	return fmt.Sprintf("%.2f", f64)
}

// pgtype.Numeric to string pointer
func pgNumericToStringPtr(pn pgtype.Numeric) *string {
	if !pn.Valid {
		return nil
	}
	var f64 float64
	pn.Scan(&f64)
	str := fmt.Sprintf("%.2f", f64)
	return &str
}

// Float64 to pgtype.Numeric
func float64ToPgNumeric(f float64) pgtype.Numeric {
	var numeric pgtype.Numeric
	numeric.Scan(f)
	return numeric
}

// pgtype.Numeric to float64
func pgNumericToFloat64(pn pgtype.Numeric) float64 {
	if !pn.Valid {
		return 0.0
	}
	var f64 float64
	pn.Scan(&f64)
	return f64
}

// pgtype.Numeric to float64 pointer
func pgNumericToFloat64Ptr(pn pgtype.Numeric) *float64 {
	if !pn.Valid {
		return nil
	}
	var f64 float64
	pn.Scan(&f64)
	return &f64
}
