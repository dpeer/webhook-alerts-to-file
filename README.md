# Webhook Alerts to File
  
Recieves alerts from Grafana or Prometheus Alertmanager webhooks and logs to alerts file. 

## Alerts APIs

### Grafana APIs
- POST /grafana/alerts

### Prometheus Alertmanager APIs
- POST /prometheus/alerts

### Status APIs
- GET /status

### Environment variables 
- PORT - Server port
- LOGGER_PATH - Log file folder
- ALERTS_FILE_PATH - Alert log file folder
