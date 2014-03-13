var should = require('should');
var async = require("async");
var WorkerRPC = require("../lib/WorkerRPC");

//WE ARE GOING TO CREATE AS MANY WORKERS AS WE HAVE CORES
var numCores = require("os").cpus().length;

var createWorkers = function(numCores,script,callback) {
	WorkerRPC.createWorkers(numCores,script, function(err,workers) {
		async.forEach(workers,function(worker,next) {
			worker.callme(function() {
				next();
			});
		},callback);
	});
}

describe('WorkerRPC', function(){
	this.timeout(10000);

	it('should work with simple objects', function(done) {
		createWorkers(numCores,"./test/dep/worker_object.js",done);
	});

	it('should work with classes methods', function(done) {
		createWorkers(numCores,"./test/dep/worker_class.js",done);
	});

	it('should work within a pool', function(done) {
		//WE ARE GOING TO CALCULATE PI USING PARALLEL MONTE CARLO METHODS

		//HOW MANY TOTAL TRIALS?
		var targetTrials = 10*1000*1000;

		//HOW MANY RUNS?
		var runs = numCores;
		var numTrialsPerCore = Math.ceil(targetTrials/runs);

		//RANDOM POINTS IN SQUARE [0,1], PI ~ 4*NUM_POINTS_INSIDE_CIRCLE/TOTAL_NUMBER_OF_POINTS
		var results = {insideCircle:0,total:0};

		var workloads = [];
		for(var i=0;i<runs;i++) {
			workloads.push({
				script: "./test/dep/pi.js",
				action: function(instance,params,finished) {
					instance.pi(numTrialsPerCore,function(insideCircle,outsideCircle,total) {
						results.insideCircle+=insideCircle;
						results.total+=total;
						finished();
					});
				},
				params: {}
			});
		}

		var pool = WorkerRPC.pool(numCores,function() {
			var piEstimate = 4*results.insideCircle/results.total;
			var piDelta = Math.abs(Math.PI - piEstimate);

			results.total.should.equal(numTrialsPerCore*runs);
			piDelta.should.be.below(0.01);

			done();
		});

		pool.add(workloads);
	});
});
