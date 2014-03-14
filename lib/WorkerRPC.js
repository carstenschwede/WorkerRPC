var spawn = require('child_process').spawn;
var fork = require('child_process').fork;

var async = require("async");
var RedisRPC = require("redisrpc");

var port = 10000;

//COLLECT CHILD PROCESS TO KILL THEM UPON EXIT
var processes = [];
process.on("exit", function() {
	processes.forEach(function(child_process) {
		child_process.kill();
	});
});

var Worker = function(port,script,callback) {
	var args = [script,port];
	//console.log("Starting Worker");
	var child_process = fork(script,[port]);
	processes.push(child_process);
	child_process.on("exit", function() {
		//console.log("Worker dead.");
	});

	setTimeout(function() {
		//console.log("CONNECTING TO PORT",port);
		RedisRPC.use(port, function(err,instance) {
			instance.killProcess = function() {
				child_process.kill();
			};
			callback(err,instance);
		});
	},1000);

	return this;
}

var WorkerRPC = {
	workers: [],
	pool: function(concurrency,finished) {
		finished = finished || function() {
			//console.log("WorkerRPC pool finished");
		}
		var cargo = async.cargo(function (subWorkloads, next) {
			async.forEach(subWorkloads, function(workload, next) {
				//console.log("working at",workload);
				WorkerRPC.createWorker(workload.script, function(err,instance) {
					//console.log("got worker, wokring",workload.action);
					workload.action(instance,workload.params,function() {
						instance.killProcess();
						next();
					});
				});
			},next);
		}, concurrency);
		cargo.drain = function() {
			finished();
		}
		var pool = {
			cargo: cargo,
			add: function(item) {
				if (item.length !== undefined && item.forEach !== undefined) {
					item.forEach(function(it) {
						cargo.push(it);
					});
					return;
				}

				cargo.push(item);
			}
		}
		return pool;
	},
	createWorker: function(script,callback) {
		port++;
		new Worker(port,script,function(err,instance) {
			if (!err)
				WorkerRPC.workers.push(instance);
			else
				console.log("ERROR",err);
			callback(err,instance);
		});
	},
	createWorkers: function(number,script,callback) {
		async.times(number,function(i,next) {
			WorkerRPC.createWorker(script,next);
		}, function() {
			callback(null,WorkerRPC.workers);
		});
	},
	wrap: function(obj) {
		return RedisRPC.wrap(obj);
	},
	createWorkload: function(options) {
		options = options || {};
		options.maxParallel = options.maxParallel || 4;

		options.map = options.map || function(workload,next) {next()};
		options.reduce = options.reduce || {
			initialValue: 0,
			iterator: function(intialValue, iterator, finished) {finished();},
			finished: function() {}
		};

		var cargo = async.cargo(function (subWorkloads, next) {
			async.map(subWorkloads, function(workload, next) {
				WorkerRPC.createWorker(options.script, function(err,instance) {
					options.map(workload,instance,function(err,result) {
						instance.killProcess();

						options.reduce.iterator(options.reduce.initialValue,result,function(err,result) {
							options.reduce.initialValue = result;
						});

						next();
					});
				});
			},next);
		}, options.maxParallel);

		cargo.drain = function() {
			options.reduce.finished(null,options.reduce.initialValue);
		}

		var workloads = function() {
			var obj = {
				tmpWorkload: [],
				cargo: cargo,
				map: function(iterator) {
					options.map = iterator;
					return obj;
				},
				reduce: function(initialValue,iterator, finished) {
					options.reduce = {
						initialValue: initialValue,
						iterator: iterator,
						finished: function(err,result) {
							obj.tmpWorkload.length = 0;
							finished(err,result);
						}
					};
					options.reduceSet = true;

					obj.tmpWorkload.forEach(function(workload) {
						cargo.push(workload);
					});
					return obj;
				},
				add: function(item) {
					var targetArray = options.reduceSet ? cargo : obj.tmpWorkload;
					if (item.length !== undefined && item.forEach !== undefined) {
						item.forEach(function(it) {
							targetArray.push(it);
						});
						return;
					}

					targetArray.push(item);
					return obj;
				}
			}
			return obj;
		};

		return new workloads();
	}
};

module.exports = WorkerRPC;