# Alerts API Reference

The Alerts API provides comprehensive monitoring and notification capabilities for volume-related events. This system includes rule-based alerting, multiple notification destinations, intelligent routing, and delivery tracking.

## 📋 Overview

**Base Path**: `/api/v1/alerts`
**Authentication**: Required (Bearer Token)
**Rate Limits**: Standard API limits apply

The Alerts API manages a complete monitoring ecosystem:

- **Alert Rules**: Define conditions that trigger alerts
- **Alert Destinations**: Configure notification channels (email, webhooks, Slack, etc.)
- **Alert Routes**: Map rules to destinations with filtering logic
- **Alert Engine**: Real-time evaluation and processing
- **Delivery Tracking**: Monitor notification delivery status

## 🚨 Alert Rules Management

Alert rules define the conditions that trigger notifications when volume or system metrics exceed thresholds.

### Create Alert Rule

Create a new alert rule with evaluation criteria and trigger conditions.

```http
POST /api/v1/alerts/rules
```

**Request Body:**
```json
{
  "name": "High Volume Usage",
  "description": "Alert when volume usage exceeds 90%",
  "enabled": true,
  "rule_type": "threshold",
  "conditions": {
    "metric": "volume.usage_percent",
    "operator": "greater_than",
    "threshold": 90.0,
    "evaluation_window": "5m",
    "consecutive_breaches": 2
  },
  "filters": {
    "volume_names": ["data-*", "app-*"],
    "exclude_volumes": ["tmp-*", "cache-*"],
    "tags": {
      "environment": "production",
      "critical": "true"
    }
  },
  "severity": "warning",
  "evaluation_interval": "60s",
  "notification_settings": {
    "retry_attempts": 3,
    "retry_delay": "5m",
    "suppress_duration": "1h"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "rule": {
      "id": "rule-001",
      "name": "High Volume Usage",
      "description": "Alert when volume usage exceeds 90%",
      "enabled": true,
      "rule_type": "threshold",
      "conditions": {
        "metric": "volume.usage_percent",
        "operator": "greater_than",
        "threshold": 90.0,
        "evaluation_window": "5m",
        "consecutive_breaches": 2
      },
      "severity": "warning",
      "evaluation_interval": "60s",
      "created_at": "2025-08-14T10:30:00Z",
      "updated_at": "2025-08-14T10:30:00Z",
      "created_by": "admin",
      "last_evaluation": null,
      "evaluation_count": 0,
      "trigger_count": 0
    }
  }
}
```

### List Alert Rules

Retrieve all alert rules with optional filtering.

```http
GET /api/v1/alerts/rules
```

**Query Parameters:**
- `enabled` (bool, optional): Filter by enabled status
- `severity` (string, optional): Filter by severity (`info`, `warning`, `critical`)
- `rule_type` (string, optional): Filter by rule type (`threshold`, `anomaly`, `pattern`)
- `search` (string, optional): Search in rule names and descriptions
- `limit` (int, optional): Number of rules to return (default: 50)
- `offset` (int, optional): Number of rules to skip (default: 0)

**Example Request:**
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/alerts/rules?enabled=true&severity=critical&limit=10"
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "rules": [
      {
        "id": "rule-001",
        "name": "Critical Volume Full",
        "description": "Alert when volume usage exceeds 95%",
        "enabled": true,
        "rule_type": "threshold",
        "severity": "critical",
        "evaluation_interval": "30s",
        "last_evaluation": "2025-08-14T15:45:00Z",
        "last_trigger": "2025-08-13T09:15:00Z",
        "trigger_count": 5,
        "status": "active"
      }
    ],
    "pagination": {
      "total": 12,
      "limit": 10,
      "offset": 0,
      "has_more": true
    }
  }
}
```

### Get Alert Rule

Retrieve detailed information for a specific alert rule.

```http
GET /api/v1/alerts/rules/{id}
```

**Path Parameters:**
- `id` (string, required): Alert rule identifier

### Update Alert Rule

Modify an existing alert rule configuration.

```http
PUT /api/v1/alerts/rules/{id}
```

**Request Body:** Same structure as Create Alert Rule

### Delete Alert Rule

Remove an alert rule from the system.

```http
DELETE /api/v1/alerts/rules/{id}
```

### Test Alert Rule

Evaluate an alert rule against current system state without triggering notifications.

```http
POST /api/v1/alerts/rules/{id}/test
```

**Request Body:**
```json
{
  "test_data": {
    "volume_id": "vol-abc123",
    "current_metrics": {
      "usage_percent": 92.5,
      "size_bytes": 10737418240,
      "growth_rate": 15.2
    }
  },
  "include_evaluation_details": true
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "test_result": {
      "rule_id": "rule-001",
      "would_trigger": true,
      "evaluation_result": {
        "condition_met": true,
        "threshold_exceeded": true,
        "current_value": 92.5,
        "threshold_value": 90.0,
        "breach_duration": "2m30s"
      },
      "affected_volumes": [
        {
          "volume_id": "vol-abc123",
          "volume_name": "app-data",
          "current_usage": 92.5,
          "trend": "increasing"
        }
      ],
      "notification_preview": {
        "title": "High Volume Usage Alert",
        "message": "Volume app-data usage is 92.5%, exceeding threshold of 90%",
        "severity": "warning",
        "timestamp": "2025-08-14T15:45:00Z"
      }
    }
  }
}
```

## 📬 Alert Destinations Management

Alert destinations define where notifications are sent when rules trigger.

### Create Alert Destination

Configure a notification channel for alert delivery.

```http
POST /api/v1/alerts/destinations
```

**Request Body:**
```json
{
  "name": "Production Alerts Slack",
  "type": "slack",
  "enabled": true,
  "configuration": {
    "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX",
    "channel": "#alerts",
    "username": "VolumeViz",
    "icon_emoji": ":warning:",
    "mention_users": ["@oncall", "@devops"],
    "thread_replies": true
  },
  "filters": {
    "severity_levels": ["warning", "critical"],
    "rule_types": ["threshold", "anomaly"],
    "time_windows": [
      {
        "days": ["mon", "tue", "wed", "thu", "fri"],
        "start_time": "09:00",
        "end_time": "17:00",
        "timezone": "America/New_York"
      }
    ]
  },
  "formatting": {
    "include_charts": true,
    "include_metrics": true,
    "template": "detailed"
  }
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "destination": {
      "id": "dest-001",
      "name": "Production Alerts Slack",
      "type": "slack",
      "enabled": true,
      "created_at": "2025-08-14T10:30:00Z",
      "last_test": null,
      "delivery_success_rate": null,
      "total_notifications": 0,
      "configuration": {
        "channel": "#alerts",
        "username": "VolumeViz",
        "icon_emoji": ":warning:"
      }
    }
  }
}
```

**Supported Destination Types:**

- **Email**: SMTP-based email notifications
- **Slack**: Slack webhook integration
- **Webhook**: Generic HTTP webhook
- **Microsoft Teams**: Teams webhook integration
- **PagerDuty**: PagerDuty incident management
- **Discord**: Discord webhook integration
- **Custom**: Configurable integrations

### List Alert Destinations

Retrieve all configured alert destinations.

```http
GET /api/v1/alerts/destinations
```

**Query Parameters:**
- `type` (string, optional): Filter by destination type
- `enabled` (bool, optional): Filter by enabled status
- `search` (string, optional): Search in destination names

### Get Alert Destination

Retrieve detailed information for a specific destination.

```http
GET /api/v1/alerts/destinations/{id}
```

### Update Alert Destination

Modify an existing alert destination.

```http
PUT /api/v1/alerts/destinations/{id}
```

### Delete Alert Destination

Remove an alert destination from the system.

```http
DELETE /api/v1/alerts/destinations/{id}
```

### Test Alert Destination

Send a test notification to verify destination configuration.

```http
POST /api/v1/alerts/destinations/{id}/test
```

**Request Body:**
```json
{
  "test_alert": {
    "title": "Test Alert",
    "message": "This is a test notification from VolumeViz",
    "severity": "info",
    "source": "manual_test"
  }
}
```

## 🔀 Alert Routes Management

Alert routes define which destinations receive notifications from specific rules.

### Create Alert Route

Map alert rules to destinations with optional filtering logic.

```http
POST /api/v1/alerts/routes
```

**Request Body:**
```json
{
  "name": "Critical Alerts to PagerDuty",
  "enabled": true,
  "rule_filters": {
    "rule_ids": ["rule-001", "rule-002"],
    "severities": ["critical"],
    "rule_types": ["threshold"]
  },
  "destination_mappings": [
    {
      "destination_id": "dest-pagerduty-001",
      "conditions": {
        "severity": ["critical"],
        "business_hours_only": false
      }
    },
    {
      "destination_id": "dest-slack-001",
      "conditions": {
        "severity": ["critical", "warning"],
        "business_hours_only": true
      }
    }
  ],
  "routing_options": {
    "escalation_delay": "5m",
    "max_escalations": 3,
    "suppress_resolved": false
  }
}
```

### List Alert Routes

```http
GET /api/v1/alerts/routes
```

### Get Alert Route

```http
GET /api/v1/alerts/routes/{id}
```

### Update Alert Route

```http
PUT /api/v1/alerts/routes/{id}
```

### Delete Alert Route

```http
DELETE /api/v1/alerts/routes/{id}
```

## ⚙️ Alert Engine Management

Control and monitor the alert evaluation engine.

### Get Engine Status

Retrieve current status and metrics for the alert engine.

```http
GET /api/v1/alerts/engine/status
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "engine": {
      "status": "running",
      "version": "1.2.0",
      "uptime_seconds": 86400,
      "last_evaluation_cycle": "2025-08-14T15:45:30Z",
      "evaluation_frequency": "30s",
      "active_rules": 15,
      "enabled_rules": 12,
      "disabled_rules": 3,
      "pending_evaluations": 2,
      "total_evaluations_today": 28800,
      "total_triggers_today": 23,
      "average_evaluation_time": "145ms",
      "memory_usage": {
        "current_mb": 128,
        "peak_mb": 256,
        "allocated_mb": 512
      },
      "performance_metrics": {
        "evaluations_per_second": 0.967,
        "success_rate": 99.95,
        "error_rate": 0.05,
        "avg_response_time": "145ms"
      }
    }
  }
}
```

### Trigger Manual Evaluation

Force immediate evaluation of all active alert rules.

```http
POST /api/v1/alerts/engine/evaluate
```

**Request Body:**
```json
{
  "rule_ids": ["rule-001", "rule-002"],
  "include_disabled": false,
  "force_notifications": false
}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "evaluation_id": "eval-20250814154530",
      "triggered_at": "2025-08-14T15:45:30Z",
      "rules_evaluated": 12,
      "rules_triggered": 2,
      "notifications_sent": 3,
      "evaluation_duration": "234ms",
      "results": [
        {
          "rule_id": "rule-001",
          "rule_name": "High Volume Usage",
          "triggered": true,
          "affected_resources": ["vol-abc123", "vol-def456"],
          "notifications_sent": 2
        }
      ]
    }
  }
}
```

## 📨 Alert Instances & History

Track active alerts and notification history.

### List Active Alerts

Retrieve currently active (unresolved) alerts.

```http
GET /api/v1/alerts
```

**Query Parameters:**
- `severity` (string, optional): Filter by severity level
- `volume_id` (string, optional): Filter alerts for specific volume
- `rule_id` (string, optional): Filter alerts from specific rule
- `status` (string, optional): Filter by status (`active`, `suppressed`, `resolved`)
- `since` (string, optional): ISO timestamp to filter alerts since
- `limit` (int, optional): Number of alerts to return (default: 50)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-20250814154530-001",
        "rule_id": "rule-001",
        "rule_name": "High Volume Usage",
        "severity": "warning",
        "status": "active",
        "triggered_at": "2025-08-14T15:45:30Z",
        "last_evaluated": "2025-08-14T15:46:00Z",
        "affected_resources": [
          {
            "type": "volume",
            "id": "vol-abc123",
            "name": "app-data",
            "current_value": 92.5,
            "threshold_value": 90.0
          }
        ],
        "notification_count": 3,
        "last_notification": "2025-08-14T15:45:45Z",
        "suppressed": false,
        "acknowledgments": []
      }
    ],
    "summary": {
      "total_active": 5,
      "by_severity": {
        "critical": 1,
        "warning": 3,
        "info": 1
      },
      "oldest_alert": "2025-08-13T08:30:00Z"
    }
  }
}
```

### Get Alert Details

Retrieve detailed information for a specific alert.

```http
GET /api/v1/alerts/{id}
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "alert": {
      "id": "alert-20250814154530-001",
      "rule_id": "rule-001",
      "rule_name": "High Volume Usage",
      "rule_description": "Alert when volume usage exceeds 90%",
      "severity": "warning",
      "status": "active",
      "triggered_at": "2025-08-14T15:45:30Z",
      "duration": "15m30s",
      "evaluation_history": [
        {
          "timestamp": "2025-08-14T15:46:00Z",
          "value": 92.8,
          "threshold": 90.0,
          "status": "breach"
        }
      ],
      "affected_resources": [
        {
          "type": "volume",
          "id": "vol-abc123",
          "name": "app-data",
          "path": "/var/lib/docker/volumes/app-data/_data",
          "current_usage": {
            "size_bytes": 10737418240,
            "usage_percent": 92.8,
            "available_bytes": 805306368
          },
          "historical_data": [
            {
              "timestamp": "2025-08-14T15:00:00Z",
              "usage_percent": 88.5
            },
            {
              "timestamp": "2025-08-14T15:30:00Z",
              "usage_percent": 91.2
            }
          ]
        }
      ],
      "notifications": [
        {
          "id": "notif-001",
          "destination_id": "dest-slack-001",
          "destination_name": "Production Alerts Slack",
          "sent_at": "2025-08-14T15:45:45Z",
          "status": "delivered",
          "delivery_time": "1.2s"
        }
      ]
    }
  }
}
```

### Get Delivery History

Track notification delivery status and metrics.

```http
GET /api/v1/alerts/deliveries
```

**Query Parameters:**
- `destination_id` (string, optional): Filter by destination
- `rule_id` (string, optional): Filter by rule
- `status` (string, optional): Filter by delivery status (`sent`, `delivered`, `failed`, `pending`)
- `since` (string, optional): ISO timestamp to filter deliveries since
- `limit` (int, optional): Number of deliveries to return (default: 100)

**Example Response:**
```json
{
  "success": true,
  "data": {
    "deliveries": [
      {
        "id": "delivery-001",
        "alert_id": "alert-20250814154530-001",
        "destination_id": "dest-slack-001",
        "destination_name": "Production Alerts Slack",
        "destination_type": "slack",
        "sent_at": "2025-08-14T15:45:45Z",
        "delivered_at": "2025-08-14T15:45:46Z",
        "status": "delivered",
        "delivery_time": "1.2s",
        "attempts": 1,
        "response_code": 200,
        "response_details": {
          "slack_ts": "1692021946.123456",
          "channel": "#alerts"
        }
      }
    ],
    "summary": {
      "total_deliveries": 156,
      "delivery_success_rate": 98.7,
      "average_delivery_time": "1.8s",
      "failed_deliveries": 2,
      "pending_deliveries": 0
    }
  }
}
```

## 🎯 Advanced Alert Features

### Rule Templates

Pre-configured alert rules for common monitoring scenarios:

```bash
# List available rule templates
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/alerts/templates"

# Create rule from template
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "/api/v1/alerts/rules/from-template" \
  -d '{
    "template_id": "volume-usage-critical",
    "parameters": {
      "threshold": 95,
      "volume_pattern": "prod-*"
    }
  }'
```

### Alert Suppression

Temporarily suppress notifications for maintenance or known issues:

```bash
# Suppress alerts for specific volume
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  "/api/v1/alerts/suppress" \
  -d '{
    "volume_id": "vol-abc123",
    "duration": "2h",
    "reason": "Planned maintenance",
    "suppress_all_rules": false,
    "rule_ids": ["rule-001"]
  }'
```

### Alert Analytics

Get insights into alert patterns and system health:

```bash
# Alert analytics dashboard data
curl -H "Authorization: Bearer $TOKEN" \
  "/api/v1/alerts/analytics?period=7d&group_by=severity,rule"
```

## ⚠️ Error Handling

### Common Error Codes

- `400 Bad Request`: Invalid alert configuration or parameters
- `404 Not Found`: Alert rule, destination, or route not found
- `409 Conflict`: Rule/destination name already exists
- `422 Unprocessable Entity`: Invalid rule conditions or destination configuration
- `503 Service Unavailable`: Alert engine temporarily unavailable

### Example Error Response

```json
{
  "success": false,
  "error": {
    "code": "INVALID_RULE_CONDITION",
    "message": "Alert rule condition contains invalid metric reference",
    "details": {
      "invalid_metric": "volume.invalid_metric",
      "available_metrics": [
        "volume.usage_percent",
        "volume.size_bytes",
        "volume.growth_rate",
        "volume.file_count"
      ],
      "condition_index": 0
    }
  }
}
```

## 🚀 Best Practices

### Rule Configuration
- Use meaningful rule names and descriptions
- Set appropriate evaluation intervals (not too frequent)
- Configure suppression duration to avoid notification spam
- Test rules thoroughly before enabling

### Destination Management
- Configure multiple destinations for redundancy
- Use time-based filtering for business hours
- Set up escalation chains for critical alerts
- Monitor delivery success rates regularly

### Performance Optimization
- Avoid overly complex rule conditions
- Use volume filters to reduce evaluation scope
- Monitor alert engine performance metrics
- Clean up resolved alerts periodically

---

**Next**: [System API Reference](system.md) | [Health API Reference](health.md)
