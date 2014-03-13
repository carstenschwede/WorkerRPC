var should = require('should');
var async = require("async");
var WorkerRPC = require("../lib/WorkerRPC");
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
		var targetTrials = 10*1000*1000;
		var runs = numCores;
		var numTrialsPerCore = Math.ceil(targetTrials/runs);


		var startedAt = +(new Date());
		var results = {insideCircle:0,outsideCircle:0,total:0};

		var pool = WorkerRPC.pool(numCores,function() {
			//console.log("Finished");
			var duration = +(new Date()) - startedAt;

			var piEstimate = 4*results.a/results.total;
			var piDelta = Math.PI - piEstimate;

			results.total.should.equal(numTrialsPerCore*runs);
			//console.log("Finished calculating PI",piEstimate,results.total,numTrialsPerCore*runs);
			done();
		});


		var workloads = [];
		for(var i=0;i<runs;i++) {
			workloads.push({
				script: "./test/dep/pi.js",
				action: function(instance,params,finished) {
					instance.pi(numTrialsPerCore,function(insideCircle,outsideCircle,total) {
						results.insideCircle+=insideCircle;
						results.outsideCircle+=outsideCircle;
						results.total+=total;
						finished();
					});
				},
				params: {}
			});
		}

		pool.add(workloads);
	});

});
