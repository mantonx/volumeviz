package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// TestScanSchedulerIntegration tests the scan scheduler integration
func main() {
	baseURL := "http://localhost:8080/api/v1"
	
	// Test scheduler status
	fmt.Println("=== Testing Scheduler Status ===")
	status, err := getSchedulerStatus(baseURL)
	if err != nil {
		log.Fatalf("Failed to get scheduler status: %v", err)
	}
	
	fmt.Printf("Scheduler Status: %+v\n", status)
	
	// Test manual volume scan trigger
	fmt.Println("\n=== Testing Manual Volume Scan ===")
	scanResult, err := triggerVolumeScan(baseURL, "test-volume")
	if err != nil {
		log.Printf("Volume scan failed (expected if volume doesn't exist): %v", err)
	} else {
		fmt.Printf("Volume scan triggered: %+v\n", scanResult)
	}
	
	// Test scheduler metrics
	fmt.Println("\n=== Testing Scheduler Metrics ===")
	metrics, err := getSchedulerMetrics(baseURL)
	if err != nil {
		log.Fatalf("Failed to get scheduler metrics: %v", err)
	}
	
	fmt.Printf("Scheduler Metrics: %+v\n", metrics)
	
	// Test health endpoint with scheduler info
	fmt.Println("\n=== Testing Health with Scheduler ===")
	health, err := getHealthWithScheduler(baseURL)
	if err != nil {
		log.Fatalf("Failed to get health: %v", err)
	}
	
	fmt.Printf("Health Status: %+v\n", health)
	
	fmt.Println("\n=== Scan Scheduler Integration Tests Completed Successfully! ===")
}

func getSchedulerStatus(baseURL string) (map[string]interface{}, error) {
	resp, err := http.Get(baseURL + "/scheduler/status")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var status map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, err
	}
	
	return status, nil
}

func triggerVolumeScan(baseURL, volumeName string) (map[string]interface{}, error) {
	resp, err := http.Post(baseURL+"/volumes/"+volumeName+"/scan", "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	
	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusAccepted {
		return result, fmt.Errorf("scan failed with status %d: %v", resp.StatusCode, result)
	}
	
	return result, nil
}

func getSchedulerMetrics(baseURL string) (map[string]interface{}, error) {
	resp, err := http.Get(baseURL + "/scheduler/metrics")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var metrics map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&metrics); err != nil {
		return nil, err
	}
	
	return metrics, nil
}

func getHealthWithScheduler(baseURL string) (map[string]interface{}, error) {
	resp, err := http.Get(baseURL + "/health")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	var health map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&health); err != nil {
		return nil, err
	}
	
	return health, nil
}