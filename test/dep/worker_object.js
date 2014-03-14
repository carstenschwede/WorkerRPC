var person = {
	callme: function(callback) {
		callback();
	},
	ping: function(callback) {
		callback("pong");
	},
	echo: function(k, callback) {
		callback(k);
	}
};


require("../../lib/WorkerRPC.js").wrap(person);