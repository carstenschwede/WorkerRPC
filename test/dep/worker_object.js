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


require("RedisRPC").wrap(person);