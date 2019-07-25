const path = require('path');
const express = require('express');
const winston = require('winston');

const myFormat = winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} ${level}: ${message}`;
});

// todo: change to env param / docker volume
const filePath = path.join(process.cwd(), `alerts_${process.pid}_${Date.now()}.log`);
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        myFormat
    ),
    transports: [
        new winston.transports.File({
            filename: filePath ,
            maxsize: 1024 * 1024 * 10,
            maxFiles: 10,
            tailable: true,
        }),
        new winston.transports.Console()
    ]
});

const app = express();
const port = 9000;

app.use(express.json({strict: true, type: "application/json"}));

app.post('/alert', (req, res) => {
    logger.info(JSON.stringify(req.body));
    res.sendStatus(200);
});

app.listen(port/*,
    () => console.log(`Example app listening on port ${port}!`)*/);