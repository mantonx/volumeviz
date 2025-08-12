package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/mantonx/volumeviz/internal/store/config"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Printf("Usage: %s <directory-or-file>\n", os.Args[0])
		fmt.Println("\nLints Go files for bare database transaction usage.")
		fmt.Println("Flags violations where code uses db.Begin() or db.BeginTx() instead of transaction helpers.")
		os.Exit(1)
	}

	target := os.Args[1]
	linter := config.NewTransactionLinter()

	// Check if target is a file or directory
	info, err := os.Stat(target)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
		os.Exit(1)
	}

	var filesToCheck []string

	if info.IsDir() {
		// Walk directory for .go files
		err = filepath.Walk(target, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			if strings.HasSuffix(info.Name(), ".go") && !strings.HasSuffix(info.Name(), "_test.go") {
				filesToCheck = append(filesToCheck, path)
			}
			return nil
		})
		if err != nil {
			fmt.Printf("Error walking directory: %v\n", err)
			os.Exit(1)
		}
	} else {
		// Single file
		if strings.HasSuffix(target, ".go") {
			filesToCheck = append(filesToCheck, target)
		}
	}

	if len(filesToCheck) == 0 {
		fmt.Println("No Go files found to lint.")
		return
	}

	totalFiles := 0
	totalErrors := 0

	// Check each file
	for _, filename := range filesToCheck {
		source, err := os.ReadFile(filename)
		if err != nil {
			fmt.Printf("Warning: Could not read file %s: %v\n", filename, err)
			continue
		}

		linter.ClearErrors()
		err = linter.CheckFile(filename, source)
		if err != nil {
			fmt.Printf("Warning: Could not parse file %s: %v\n", filename, err)
			continue
		}

		if linter.HasErrors() {
			errors := linter.GetErrors()
			for _, errMsg := range errors {
				fmt.Println(errMsg)
			}
			totalErrors += len(errors)
		}

		totalFiles++
	}

	// Print summary
	if totalErrors > 0 {
		fmt.Printf("\n❌ Found %d transaction linting errors in %d files\n", totalErrors, totalFiles)
		fmt.Println("\nTo fix these issues:")
		fmt.Println("  • Replace bare db.Begin() with db.Tx(), db.FastTx(), or db.BulkTx()")
		fmt.Println("  • Replace bare db.BeginTx() with db.TxWithTimeout()")
		fmt.Println("  • Use store.Tx() for Store interface operations")
		fmt.Println("  • See examples/transaction_refactoring_example.go for patterns")
		os.Exit(1)
	} else {
		fmt.Printf("✅ No transaction linting errors found in %d files\n", totalFiles)
	}
}
