const path = require('path');
const os = require('os');
const url = require('url');
const winston = require('winston');
const express = require('express');

const myFormat = winston.format.printf(({level, message, timestamp}) => {
	return `${timestamp} ${level}: ${message}`;
});

const myAlertFormat = winston.format.printf(({message}) => {
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
const SEP = ';';
const maxEvals = 5;

app.use(express.json({strict: true, type: "application/json"}));

app.get('/status', (req, res) => {
	res.json({
		grafanaAlerts: grafanaAlertsCntr,
		prometheusAlerts: prometheusAlertsCntr
	});
});

app.post('/grafana/alerts', (req, res) => {
	logger.debug(JSON.stringify(req.body));

	const alert = req.body;
	const evalMatches = [];
	const evalMatchesCnt = alert.evalMatches && alert.evalMatches.length ? alert.evalMatches.length : 0;
	for (let idx = 0; idx < maxEvals; idx++) {
		let evalMatch = (idx < evalMatchesCnt) ? new GrafanaEvalMatch(alert.evalMatches[idx]) : new GrafanaEvalMatch({
			metric: '',
			value: '',
			tags: {}
		});
		evalMatches.push(evalMatch);
	}

	const logMsgArr = [
		alert.title,
		alert.message,
		new Date().toISOString(),
		alert.ruleName,
		alert.ruleUrl ? url.parse(alert.ruleUrl).hostname : '',
		alert.severity || 'High',
		alert.state,
		alert.ruleId,
	];
	evalMatches.forEach((evalMatch) => {
		logMsgArr.push(evalMatch.toString());
	});

	alertsLogger.info(logMsgArr.join(SEP));

	grafanaAlertsCntr++;
	res.sendStatus(200);
});

class GrafanaEvalMatch {
	constructor({metric, value, tags}) {
		this.metric = metric;
		this.value = value;
		this.tags = tags
	}

	toString() {
		let tagsStr = '';
		if (this.tags) {
			Object.keys(this.tags).forEach((key) => {
				tagsStr += key + ':' + this.tags[key] + '&';
			});
			tagsStr = tagsStr.slice(0, -1);
		}

		return this.metric + SEP + this.value + SEP + tagsStr;
	}
}

app.post('/prometheus/alerts', (req, res) => {
	logger.debug(JSON.stringify(req.body));

	let alertMsg = req.body;
	let timestamp = new Date().toISOString();
	let logMsgArr;
	alertMsg.alerts.forEach((alert) => {
		logMsgArr = [
			alert.annotations ? alert.annotations.summary : '',
			alert.annotations ? alert.annotations.description : '',
			timestamp,
			alert.labels ? alert.labels.alertname : '',
			alert.labels ? getServerWithoutPort(alert.labels.instance) : '',
			alert.labels ? alert.labels.severity : '',
			alert.status
		];
		alertsLogger.info(logMsgArr.join(SEP));
		prometheusAlertsCntr++;
	});
	res.sendStatus(200);
});

function getServerWithoutPort(server) {
	if (!server) {
		return '';
	}

	let portIdx = server.indexOf(':');
	return (portIdx < 0) ? server : server.substr(0, portIdx);
}

app.listen(port, () => {
	logger.info(`Listening on port: ${port}`);
	logger.info(`Alerts file path: ${alertsFilePath}`);
});
