package config

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"strings"
)

// TransactionLinter checks for bare transaction usage that bypasses the Tx helper
type TransactionLinter struct {
	fileSet *token.FileSet
	errors  []string
}

// NewTransactionLinter creates a new transaction linter
func NewTransactionLinter() *TransactionLinter {
	return &TransactionLinter{
		fileSet: token.NewFileSet(),
		errors:  make([]string, 0),
	}
}

// CheckFile analyzes a Go file for bare transaction usage
func (l *TransactionLinter) CheckFile(filename string, source []byte) error {
	// Parse the Go file
	file, err := parser.ParseFile(l.fileSet, filename, source, parser.ParseComments)
	if err != nil {
		return fmt.Errorf("failed to parse file %s: %w", filename, err)
	}

	// Walk the AST and look for problematic patterns
	ast.Inspect(file, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.CallExpr:
			l.checkCallExpression(node, filename)
		case *ast.AssignStmt:
			l.checkAssignStatement(node, filename)
		}
		return true
	})

	return nil
}

// checkCallExpression looks for bare Begin() or BeginTx() calls
func (l *TransactionLinter) checkCallExpression(call *ast.CallExpr, filename string) {
	if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
		methodName := sel.Sel.Name

		// Check for bare Begin() or BeginTx() calls
		if methodName == "Begin" || methodName == "BeginTx" {
			// Allow calls on sql.DB or similar, but flag calls on our DB type
			if ident, ok := sel.X.(*ast.Ident); ok {
				// This is a simple heuristic - in practice you'd want more sophisticated analysis
				if strings.Contains(ident.Name, "db") || strings.Contains(ident.Name, "DB") {
					pos := l.fileSet.Position(call.Pos())
					l.errors = append(l.errors, fmt.Sprintf(
						"%s:%d:%d: bare transaction call '%s()' detected - use db.Tx(), db.FastTx(), or db.BulkTx() instead",
						filename, pos.Line, pos.Column, methodName,
					))
				}
			}
		}
	}
}

// checkAssignStatement looks for transaction assignments that might bypass the helper
func (l *TransactionLinter) checkAssignStatement(assign *ast.AssignStmt, filename string) {
	// Look for patterns like: tx, err := db.Begin()
	if len(assign.Lhs) >= 1 && len(assign.Rhs) == 1 {
		if call, ok := assign.Rhs[0].(*ast.CallExpr); ok {
			if sel, ok := call.Fun.(*ast.SelectorExpr); ok {
				methodName := sel.Sel.Name
				if methodName == "Begin" || methodName == "BeginTx" {
					// Check if the first assignment target suggests it's a transaction
					if ident, ok := assign.Lhs[0].(*ast.Ident); ok &&
						(ident.Name == "tx" || strings.Contains(ident.Name, "tx") ||
							strings.Contains(ident.Name, "Tx") || strings.Contains(ident.Name, "transaction")) {
						pos := l.fileSet.Position(assign.Pos())
						l.errors = append(l.errors, fmt.Sprintf(
							"%s:%d:%d: bare transaction assignment detected - use db.Tx() helper for consistent error handling",
							filename, pos.Line, pos.Column,
						))
					}
				}
			}
		}
	}
}

// GetErrors returns all detected linting errors
func (l *TransactionLinter) GetErrors() []string {
	return l.errors
}

// ClearErrors clears all detected linting errors
func (l *TransactionLinter) ClearErrors() {
	l.errors = make([]string, 0)
}

// HasErrors returns true if any linting errors were detected
func (l *TransactionLinter) HasErrors() bool {
	return len(l.errors) > 0
}

// Print outputs all linting errors to stdout
func (l *TransactionLinter) Print() {
	for _, err := range l.errors {
		fmt.Println(err)
	}
}

// AllowedTransactionPatterns lists the approved transaction helper methods
var AllowedTransactionPatterns = []string{
	"Tx(",
	"TxWithTimeout(",
	"ReadOnlyTx(",
	"FastTx(",
	"BulkTx(",
}

// IsAllowedTransactionPattern checks if a transaction call uses an approved helper
func IsAllowedTransactionPattern(code string) bool {
	for _, pattern := range AllowedTransactionPatterns {
		if strings.Contains(code, pattern) {
			return true
		}
	}
	return false
}
