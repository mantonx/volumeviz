package main

import (
	"fmt"
	"go/parser"
	"go/token"
	"os"
	"path/filepath"
	"strings"
)

// LayerRule defines import restrictions for each layer
type LayerRule struct {
	Layer            string
	AllowedImports   []string // Packages that are allowed to be imported
	ForbiddenImports []string // Packages that must not be imported
	Description      string
}

var layerRules = []LayerRule{
	{
		Layer: "internal/db/connect.go",
		AllowedImports: []string{
			"context",
			"fmt",
			"github.com/jackc/pgx/v5/pgxpool",
			"github.com/mantonx/volumeviz/internal/db/sqlc",
		},
		ForbiddenImports: []string{
			"github.com/mantonx/volumeviz/internal/repo",
			"github.com/mantonx/volumeviz/internal/store",
			"github.com/mantonx/volumeviz/internal/models",
		},
		Description: "db layer should only handle connections and sqlc generated code",
	},
	{
		Layer: "internal/repo/",
		AllowedImports: []string{
			"context",
			"encoding/json",
			"fmt",
			"time",
			"github.com/jackc/pgx/v5/pgtype",
			"github.com/mantonx/volumeviz/internal/db/sqlc",
			"github.com/mantonx/volumeviz/internal/models",
		},
		ForbiddenImports: []string{
			"github.com/jackc/pgx/v5/pgxpool",
			"database/sql",
			"github.com/mattn/go-sqlite3",
			"github.com/mantonx/volumeviz/internal/store",
		},
		Description: "repo layer should only import sqlc and models, no direct database connections",
	},
	{
		Layer: "internal/store/store",
		AllowedImports: []string{
			"context",
			"github.com/jackc/pgx/v5",
			"github.com/mantonx/volumeviz/internal/db",
			"github.com/mantonx/volumeviz/internal/db/sqlc",
			"github.com/mantonx/volumeviz/internal/repo",
		},
		ForbiddenImports: []string{
			"database/sql",
			"github.com/mattn/go-sqlite3",
			"github.com/mantonx/volumeviz/internal/models", // Store should get models through repo interfaces
		},
		Description: "store layer should only handle transactions and provide repo access",
	},
}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintf(os.Stderr, "Usage: %s <directory>\n", os.Args[0])
		os.Exit(1)
	}

	dir := os.Args[1]
	violations := 0

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
			return nil
		}

		// Determine which layer this file belongs to
		var currentRule *LayerRule
		for _, rule := range layerRules {
			if strings.Contains(path, rule.Layer) {
				currentRule = &rule
				break
			}
		}

		if currentRule == nil {
			// File is not in a layer we care about
			return nil
		}

		fileViolations, err := checkFileImports(path, *currentRule)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error checking %s: %v\n", path, err)
			return err
		}

		violations += fileViolations
		return nil
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "Error walking directory: %v\n", err)
		os.Exit(1)
	}

	if violations > 0 {
		fmt.Printf("\n❌ Found %d import violations\n", violations)
		fmt.Println("\nTo fix these violations:")
		fmt.Println("1. Remove forbidden imports from the violating files")
		fmt.Println("2. Use dependency injection to pass dependencies through layer boundaries")
		fmt.Println("3. Ensure services only import store + models packages")
		os.Exit(1)
	} else {
		fmt.Println("✅ All import checks passed - layer boundaries are properly enforced")
	}
}

func checkFileImports(filePath string, rule LayerRule) (int, error) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, nil, parser.ParseComments)
	if err != nil {
		return 0, err
	}

	violations := 0

	for _, imp := range node.Imports {
		importPath := strings.Trim(imp.Path.Value, `"`)

		// Check forbidden imports
		for _, forbidden := range rule.ForbiddenImports {
			if strings.Contains(importPath, forbidden) || importPath == forbidden {
				fmt.Printf("❌ %s: forbidden import '%s' in %s layer\n", filePath, importPath, rule.Layer)
				fmt.Printf("   Reason: %s\n", rule.Description)
				violations++
			}
		}

		// Check if import is in allowed list (for strict checking)
		if isInternalImport(importPath) {
			allowed := false
			for _, allowedPkg := range rule.AllowedImports {
				if strings.Contains(importPath, allowedPkg) || importPath == allowedPkg {
					allowed = true
					break
				}
			}

			if !allowed {
				// Check if it's a standard library or external dependency (those are generally allowed)
				if !isStandardLibrary(importPath) && !isExternalDependency(importPath) {
					fmt.Printf("⚠️  %s: potentially disallowed import '%s' in %s layer\n", filePath, importPath, rule.Layer)
					fmt.Printf("   Reason: %s\n", rule.Description)
					// Don't count as violation for now, just warn
				}
			}
		}
	}

	return violations, nil
}

func isInternalImport(importPath string) bool {
	return strings.Contains(importPath, "github.com/mantonx/volumeviz/internal/")
}

func isStandardLibrary(importPath string) bool {
	// Simple heuristic: standard library packages don't contain dots or are well-known
	standardPkgs := []string{
		"context", "fmt", "os", "path", "strings", "time", "encoding/json",
		"net/http", "database/sql", "log", "errors", "io", "sync", "syscall",
	}

	for _, pkg := range standardPkgs {
		if importPath == pkg || strings.HasPrefix(importPath, pkg+"/") {
			return true
		}
	}

	return !strings.Contains(importPath, ".")
}

func isExternalDependency(importPath string) bool {
	// External dependencies contain domain names but are not our internal packages
	return strings.Contains(importPath, ".") && !strings.Contains(importPath, "github.com/mantonx/volumeviz/")
}
