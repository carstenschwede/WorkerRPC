var spawn = require('child_process').spawn;
var fork = require('child_process').fork;
var async = require("async");
//var RedisRPC = require("../../RedisRPC/lib/redisrpc");
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
	//node --stack-size=65500 --max_old_space_size=20000


	//console.log("ACTUALLY SPAWNIG A NEW WORKER FOR",script);
	var useSpawn = true;
	var child_process;
	if (useSpawn) {
		var args = [__dirname+"/startNode.sh",script,port];
		child_process = spawn("bash",args);
		child_process.stdout.on("data", function(d) {
			console.log(d.toString());
		})
		child_process.stderr.on("data", function(d) {
			console.log(d.toString());
		})

	} else {
		child_process = fork(script,[port]);
	}
	processes.push(child_process);


	child_process.on("close", function(d) {
		console.log("WORER CLOSED"+d);
	})
	child_process.on("exit", function(a) {
		console.log("Worker dead.",a);
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
		var self = this;

		finished = finished || function() {
			//console.log("WorkerRPC pool finished");
		}

		var reUseWorkers = true;

		this.workerCache = {};

		if (reUseWorkers) {

			//KILL CHILD PROCESSES ON EXIT
			process.on("exit", function() {
				Object.values(self.workerCache).forEach(function(worker) {
					worker.killProcess();
				});
			});
		}

		var getWorker = function(script,callback) {
			if (!reUseWorkers) {
				return WorkerRPC.createWorker(script,callback);
			}

			var workers = self.workerCache[script] || [];
			var freeWorker = workers.filter(function(worker) {
				return !worker._isWorking;
			})[0];

			if (freeWorker) {
				//console.log("REUSING FERE WORKER");
				return callback(null,freeWorker);
			}

			//console.log("CREATING BRAND NEW WORKER");

			WorkerRPC.createWorker(script,function(err,newWorker) {
				self.workerCache[script] = self.workerCache[script] || [];
				self.workerCache[script].push(newWorker);
				callback(err,newWorker);
			});
		}

		var cargo = async.cargo(function (subWorkloads, next) {
			async.forEach(subWorkloads, function(workload, next) {
				//console.log("working at",workload);
				setImmediate(function() {
					getWorker(workload.script, function(err,instance) {
						//console.log("GOT WORKER",instance);
					//WorkerRPC.createWorker(workload.script, function(err,instance) {
						instance._isWorking = true;
						//console.log("got worker, wokring",workload.action);
						workload.action(instance,workload.params,function() {
							instance._isWorking = false;
							if (!reUseWorkers) {
								//console.log("KILLING WORKER");
								instance.killProcess();
							}
							next();
						});
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
			setImmediate(function() {
				WorkerRPC.createWorker(script,next);
			});
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
				setImmediate(function() {
					WorkerRPC.createWorker(options.script, function(err,instance) {
						options.map(workload,instance,function(err,result) {
							instance.killProcess();

							options.reduce.iterator(options.reduce.initialValue,result,function(err,result) {
								options.reduce.initialValue = result;
							});

							next();
						});
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