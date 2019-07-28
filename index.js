const path = require('path');
const os = require('os');
const winston = require('winston');
const express = require('express');

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

const loggerFileName = `webhook-alerts_${process.pid}_${Date.now()}.log`;
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
        }),
        new winston.transports.Console()
    ]
});

const alertsFilePath = process.env.ALERTS_FILE_PATH ? process.env.ALERTS_FILE_PATH : path.join(process.cwd(), 'alerts.log');
const alertsLogger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        myFormat
    ),
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
let promethuesAlertsCntr = 0;

app.use(express.json({strict: true, type: "application/json"}));

app.get('/status', (req, res) => {
    res.json({
        grafanaAlerts: grafanaAlertsCntr,
        promethuesAlerts: promethuesAlertsCntr
    });
});

app.post('/grafana/alerts', (req, res) => {
    alertsLogger.info(JSON.stringify(req.body));
    grafanaAlertsCntr++;
    res.sendStatus(200);
});

app.post('/promethues/alerts', (req, res) => {
    alertsLogger.info(JSON.stringify(req.body));
    promethuesAlertsCntr++;
    res.sendStatus(200);
});

app.listen(port, () => {
    logger.info(`Listening on port: ${port}`);
    logger.info(`Alerts file path: ${alertsFilePath}`);
});