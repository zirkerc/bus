"use strict";

const registerBot = require("./steps/register.js");
const s3LoadTrigger = require('./steps/s3-load-trigger.js');
const addCrons = require('./steps/add-crons.js');
const sendCustomResourceResponse = require('../../lib/sendCustomResourceResponse');

exports.handler = (event, _, callback) => {
	console.log(JSON.stringify(event, null, 2));

	process.on('uncaughtException', function (err) {
		console.log("Got unhandled Exception: ", err);
		sendCustomResourceResponse(event, 'FAILED', 'Uncaught Exception')
			.then(() => callback()).catch(callback);
	});

	// Handle 3rd party install requests
	let steps = [];
	const ignoreProperties = [ 'ServiceToken', 'Version' ];
	let keys = Object.keys(event.ResourceProperties || {}).filter(k => ignoreProperties.includes(k));

	if (keys.length) {
		event.PhysicalResourceId = event.LogicalResourceId;
		keys.map(key => {
			let data = event.ResourceProperties[key];
			steps.push(registerBot(key, data));
		});
	} else {
		event.PhysicalResourceId = "install";
		steps.push(s3LoadTrigger());
		steps.push(addCrons());
	}

	Promise.all(steps).then(() => {
		console.log("Got success");
		sendCustomResourceResponse(event, 'SUCCESS')
			.then((result) => callback(null, result)).catch(callback);
	}).catch((err) => {
		console.log("Got error:", err);
		sendCustomResourceResponse(event, 'FAILED', 'It Failed!')
			.then((result) => callback(null, result)).catch(callback);
	});
};
