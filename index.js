const path = require('path');
const os = require('os');
const url = require('url');
const winston = require('winston');
const express = require('express');

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

const myAlertFormat = winston.format.printf(({ message }) => {
    return `${message}`;
});

const loggerFileName = `webhook-alerts_${process.pid}_${new Date().toISOString()}.log`;
const loggerFilePath = process.env.LOGGER_PATH ? path.join(process.env.LOGGER_PATH, loggerFileName) : path.join(os.tmpdir(), loggerFileName);
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        myFormat
    ),
    transports: [
        new winston.transports.File({
            filename: loggerFilePath,
            maxsize: 1024 * 1024 * 10,
            maxFiles: 10,
            tailable: true,
            level: 'debug'
        }),
        new winston.transports.Console()
    ]
});

const alertsFilePath = process.env.ALERTS_FILE_PATH ? process.env.ALERTS_FILE_PATH : path.join(process.cwd(), 'alerts.log');
const alertsLogger = winston.createLogger({
    format: myAlertFormat,
    transports: [
        new winston.transports.File({
            filename: alertsFilePath,
            maxsize: 1024 * 1024 * 10,
            maxFiles: 10,
            tailable: true,
        }),
        new winston.transports.Console()
    ]
});

const app = express();
const port = process.env.PORT || 9000;

let grafanaAlertsCntr = 0;
let prometheusAlertsCntr = 0;

app.use(express.json({strict: true, type: "application/json"}));

app.get('/status', (req, res) => {
    res.json({
        grafanaAlerts: grafanaAlertsCntr,
        prometheusAlerts: prometheusAlertsCntr
    });
});

app.post('/grafana/alerts', (req, res) => {
    logger.debug(JSON.stringify(req.body));

	let alert = req.body;
	let metric, value;
	if (alert.evalMatches && alert.evalMatches.length) {
	    metric = alert.evalMatches[0].metric;
        value = alert.evalMatches[0].value;
    }

    let logMsgArr = [
        alert.title,
        alert.message,
        new Date().toISOString(),
        alert.ruleName,
        alert.ruleUrl ? url.parse(alert.ruleUrl).hostname : '',
        alert.severity || 'High',
        alert.state,
        alert.ruleId,
        metric,
        value
    ];
	alertsLogger.info(logMsgArr.join(';'));

    grafanaAlertsCntr++;
    res.sendStatus(200);
});

app.post('/prometheus/alerts', (req, res) => {
    logger.debug(JSON.stringify(req.body));

    let alertMsg = req.body;
    let timestamp = new Date().toISOString();
    let logMsgArr;
    alertMsg.alerts.forEach((alert) => {
        logMsgArr =[
            alert.annotations ? alert.annotations.summary : '',
            alert.annotations ? alert.annotations.description : '',
            timestamp,
            alert.labels ? alert.labels.alertname : '',
            alert.labels ? getServerWithoutPort(alert.labels.instance) : '',
            alert.labels ? alert.labels.severity : '',
            alert.status
        ];
        alertsLogger.info(logMsgArr.join(';'));
        prometheusAlertsCntr++;
    });
    res.sendStatus(200);
});

app.listen(port, () => {
    logger.info(`Listening on port: ${port}`);
    logger.info(`Alerts file path: ${alertsFilePath}`);
});

function getServerWithoutPort(server) {
    if (!server) {
        return '';
    }

    let portIdx = server.indexOf(':');
    return (portIdx < 0) ? server : server.substr(0, portIdx);
}