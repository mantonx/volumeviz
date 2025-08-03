// Package database provides repository pattern implementation for data access
// Uses PostgreSQL as the backing store with connection pooling and transactions
package database

import (
	"database/sql"
	"fmt"
	"reflect"
	"strings"
	"time"
	
	"github.com/mantonx/volumeviz/internal/utils"
)

// Repository interface defines common database operations
type Repository interface {
	// Transaction management
	WithTx(tx *Tx) Repository
	BeginTx() (*Tx, error)
	
	// Health and status
	Health() *HealthStatus
	Ping() error
}

// BaseRepository provides common database operations
// Can operate within a transaction or use the main connection pool
type BaseRepository struct {
	db *DB
	tx *Tx
}

// NewBaseRepository creates a new base repository
// Uses the main database connection pool
func NewBaseRepository(db *DB) *BaseRepository {
	return &BaseRepository{db: db}
}

// WithTx returns a new repository instance using the provided transaction
// All operations will be performed within the transaction context
func (r *BaseRepository) WithTx(tx *Tx) *BaseRepository {
	return &BaseRepository{
		db: r.db,
		tx: tx,
	}
}

// BeginTx starts a new transaction
// Remember to call Commit() or Rollback() when done
func (r *BaseRepository) BeginTx() (*Tx, error) {
	return r.db.BeginTx()
}

// Health returns database health status
// Includes connection stats and latency info
func (r *BaseRepository) Health() *HealthStatus {
	return r.db.Health()
}

// Ping checks database connectivity
// Returns error if connection is down
func (r *BaseRepository) Ping() error {
	return r.db.Ping()
}

// getExecutor returns the appropriate executor (transaction or database)
func (r *BaseRepository) getExecutor() Executor {
	if r.tx != nil {
		return r.tx
	}
	return r.db
}

// Executor interface abstracts sql.DB and sql.Tx operations
type Executor interface {
	Exec(query string, args ...interface{}) (sql.Result, error)
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
}

// QueryBuilder helps build dynamic SQL queries safely
// Prevents SQL injection through parameterized queries
type QueryBuilder struct {
	selectFields []string
	fromTable    string
	joins        []string
	whereClause  []string
	orderBy      []string
	limit        *int
	offset       *int
	args         []interface{}
	argIndex     int
}

// NewQueryBuilder creates a new query builder
// Start with this then chain methods to build your query
func NewQueryBuilder() *QueryBuilder {
	return &QueryBuilder{
		args: make([]interface{}, 0),
	}
}

// Select adds fields to SELECT clause
// Pass field names or expressions like "COUNT(*)"
func (qb *QueryBuilder) Select(fields ...string) *QueryBuilder {
	qb.selectFields = append(qb.selectFields, fields...)
	return qb
}

// From sets the FROM table
// Can include alias like "volumes v"
func (qb *QueryBuilder) From(table string) *QueryBuilder {
	qb.fromTable = table
	return qb
}

// Join adds a JOIN clause
// Example: "LEFT JOIN containers c ON c.volume_id = v.id"
func (qb *QueryBuilder) Join(join string) *QueryBuilder {
	qb.joins = append(qb.joins, join)
	return qb
}

// Where adds a WHERE condition with parameterized values
// Use ? placeholders for values, they'll be converted to $1, $2, etc
func (qb *QueryBuilder) Where(condition string, args ...interface{}) *QueryBuilder {
	// Replace ? placeholders with $1, $2, etc.
	parameterizedCondition := condition
	for range args {
		qb.argIndex++
		parameterizedCondition = strings.Replace(parameterizedCondition, "?", fmt.Sprintf("$%d", qb.argIndex), 1)
	}
	
	qb.whereClause = append(qb.whereClause, parameterizedCondition)
	qb.args = append(qb.args, args...)
	return qb
}

// OrderBy adds ORDER BY clause
func (qb *QueryBuilder) OrderBy(orderBy string) *QueryBuilder {
	qb.orderBy = append(qb.orderBy, orderBy)
	return qb
}

// Limit sets the LIMIT
func (qb *QueryBuilder) Limit(limit int) *QueryBuilder {
	qb.limit = &limit
	return qb
}

// Offset sets the OFFSET
func (qb *QueryBuilder) Offset(offset int) *QueryBuilder {
	qb.offset = &offset
	return qb
}

// Build constructs the final SQL query
func (qb *QueryBuilder) Build() (string, []interface{}) {
	var query strings.Builder
	
	// SELECT
	if len(qb.selectFields) > 0 {
		query.WriteString("SELECT ")
		query.WriteString(strings.Join(qb.selectFields, ", "))
	} else {
		query.WriteString("SELECT *")
	}
	
	// FROM
	if qb.fromTable != "" {
		query.WriteString(" FROM ")
		query.WriteString(qb.fromTable)
	}
	
	// JOINs
	for _, join := range qb.joins {
		query.WriteString(" ")
		query.WriteString(join)
	}
	
	// WHERE
	if len(qb.whereClause) > 0 {
		query.WriteString(" WHERE ")
		query.WriteString(strings.Join(qb.whereClause, " AND "))
	}
	
	// ORDER BY
	if len(qb.orderBy) > 0 {
		query.WriteString(" ORDER BY ")
		query.WriteString(strings.Join(qb.orderBy, ", "))
	}
	
	// LIMIT
	if qb.limit != nil {
		qb.argIndex++
		query.WriteString(fmt.Sprintf(" LIMIT $%d", qb.argIndex))
		qb.args = append(qb.args, *qb.limit)
	}
	
	// OFFSET
	if qb.offset != nil {
		qb.argIndex++
		query.WriteString(fmt.Sprintf(" OFFSET $%d", qb.argIndex))
		qb.args = append(qb.args, *qb.offset)
	}
	
	return query.String(), qb.args
}

// ScanRows is a helper function to scan multiple rows into a slice
func ScanRows[T any](rows *sql.Rows, scanFunc func(*sql.Rows) (*T, error)) ([]*T, error) {
	var results []*T
	
	for rows.Next() {
		item, err := scanFunc(rows)
		if err != nil {
			return nil, utils.WrapError(err, "failed to scan row")
		}
		results = append(results, item)
	}
	
	if err := rows.Err(); err != nil {
		return nil, utils.WrapError(err, "rows iteration error")
	}
	
	return results, nil
}

// FilterOptions represents common filtering options
type FilterOptions struct {
	Limit      *int              `json:"limit,omitempty"`
	Offset     *int              `json:"offset,omitempty"`
	OrderBy    *string           `json:"order_by,omitempty"`
	OrderDesc  bool              `json:"order_desc,omitempty"`
	Filters    map[string]interface{} `json:"filters,omitempty"`
	CreatedAfter  *time.Time     `json:"created_after,omitempty"`
	CreatedBefore *time.Time     `json:"created_before,omitempty"`
}

// ApplyToQuery applies filter options to a query builder
func (fo *FilterOptions) ApplyToQuery(qb *QueryBuilder, tableAlias string) *QueryBuilder {
	if fo == nil {
		return qb
	}
	
	// Apply generic filters
	for field, value := range fo.Filters {
		if value != nil {
			fieldName := field
			if tableAlias != "" {
				fieldName = tableAlias + "." + field
			}
			
			// Handle different types of values
			switch v := value.(type) {
			case string:
				if strings.Contains(v, "%") {
					qb.Where(fieldName+" LIKE ?", v)
				} else {
					qb.Where(fieldName+" = ?", v)
				}
			case []interface{}:
				if len(v) > 0 {
					placeholders := make([]string, len(v))
					for i := range v {
						placeholders[i] = "?"
					}
					qb.Where(fieldName+" IN ("+strings.Join(placeholders, ", ")+")", v...)
				}
			default:
				qb.Where(fieldName+" = ?", v)
			}
		}
	}
	
	// Apply date range filters
	if fo.CreatedAfter != nil {
		fieldName := "created_at"
		if tableAlias != "" {
			fieldName = tableAlias + ".created_at"
		}
		qb.Where(fieldName+" >= ?", *fo.CreatedAfter)
	}
	
	if fo.CreatedBefore != nil {
		fieldName := "created_at"
		if tableAlias != "" {
			fieldName = tableAlias + ".created_at"
		}
		qb.Where(fieldName+" <= ?", *fo.CreatedBefore)
	}
	
	// Apply ordering
	if fo.OrderBy != nil {
		orderBy := *fo.OrderBy
		if tableAlias != "" && !strings.Contains(orderBy, ".") {
			orderBy = tableAlias + "." + orderBy
		}
		if fo.OrderDesc {
			orderBy += " DESC"
		}
		qb.OrderBy(orderBy)
	}
	
	// Apply pagination
	if fo.Limit != nil {
		qb.Limit(*fo.Limit)
	}
	
	if fo.Offset != nil {
		qb.Offset(*fo.Offset)
	}
	
	return qb
}

// PaginatedResult represents a paginated query result
type PaginatedResult[T any] struct {
	Items      []*T `json:"items"`
	Total      int  `json:"total"`
	Limit      int  `json:"limit"`
	Offset     int  `json:"offset"`
	HasMore    bool `json:"has_more"`
	TotalPages int  `json:"total_pages"`
}

// NewPaginatedResult creates a new paginated result
func NewPaginatedResult[T any](items []*T, total, limit, offset int) *PaginatedResult[T] {
	result := &PaginatedResult[T]{
		Items:  items,
		Total:  total,
		Limit:  limit,
		Offset: offset,
	}
	
	if limit > 0 {
		result.TotalPages = (total + limit - 1) / limit // Ceiling division
		result.HasMore = offset+limit < total
	}
	
	return result
}

// StructToMap converts a struct to a map using reflection (for INSERT/UPDATE)
func StructToMap(s interface{}, excludeFields ...string) map[string]interface{} {
	result := make(map[string]interface{})
	v := reflect.ValueOf(s)
	t := reflect.TypeOf(s)
	
	// Handle pointers
	if v.Kind() == reflect.Ptr {
		v = v.Elem()
		t = t.Elem()
	}
	
	if v.Kind() != reflect.Struct {
		return result
	}
	
	excludeMap := make(map[string]bool)
	for _, field := range excludeFields {
		excludeMap[field] = true
	}
	
	processStruct(v, t, result, excludeMap)
	
	return result
}

// processStruct recursively processes struct fields, flattening embedded structs
func processStruct(v reflect.Value, t reflect.Type, result map[string]interface{}, excludeMap map[string]bool) {
	for i := 0; i < v.NumField(); i++ {
		field := t.Field(i)
		value := v.Field(i)
		
		// Skip unexported fields
		if !value.CanInterface() {
			continue
		}
		
		// Check if this is an embedded struct
		if field.Anonymous && value.Kind() == reflect.Struct {
			// Recursively process embedded struct fields
			processStruct(value, value.Type(), result, excludeMap)
			continue
		}
		
		// Get field name from db tag or use field name
		dbTag := field.Tag.Get("db")
		if dbTag == "-" {
			continue // Skip fields marked with db:"-"
		}
		
		fieldName := field.Name
		if dbTag != "" {
			fieldName = dbTag
		}
		
		// Skip excluded fields
		if excludeMap[fieldName] {
			continue
		}
		
		// Skip empty values for certain types
		if value.Kind() == reflect.Ptr && value.IsNil() {
			continue
		}
		
		// Skip zero time values
		if timeVal, ok := value.Interface().(time.Time); ok && timeVal.IsZero() {
			continue
		}
		
		result[fieldName] = value.Interface()
	}
}

// BuildInsertQuery builds an INSERT query from a map of fields
func BuildInsertQuery(table string, fields map[string]interface{}) (string, []interface{}) {
	if len(fields) == 0 {
		return "", nil
	}
	
	var fieldNames []string
	var placeholders []string
	var values []interface{}
	
	i := 1
	for field, value := range fields {
		fieldNames = append(fieldNames, field)
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		values = append(values, value)
		i++
	}
	
	query := fmt.Sprintf(
		"INSERT INTO %s (%s) VALUES (%s)",
		table,
		strings.Join(fieldNames, ", "),
		strings.Join(placeholders, ", "),
	)
	
	return query, values
}

// BuildUpdateQuery builds an UPDATE query from a map of fields
func BuildUpdateQuery(table string, fields map[string]interface{}, whereField string, whereValue interface{}) (string, []interface{}) {
	if len(fields) == 0 {
		return "", nil
	}
	
	var setParts []string
	var values []interface{}
	
	i := 1
	for field, value := range fields {
		setParts = append(setParts, fmt.Sprintf("%s = $%d", field, i))
		values = append(values, value)
		i++
	}
	
	// Add WHERE clause
	values = append(values, whereValue)
	
	query := fmt.Sprintf(
		"UPDATE %s SET %s WHERE %s = $%d",
		table,
		strings.Join(setParts, ", "),
		whereField,
		i,
	)
	
	return query, values
}