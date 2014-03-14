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

	it('should work within a pool with callback/RPC', function(done) {
		var results = {insideCircle:0,total:0};
		var workloads = [];
		for(var i = 0;i < 10; i++) {
		  workloads.push({
		        script: "./test/dep/pi.js",
		        action: function(instance,params,finished) {
		            instance.pi(1000000,function(insideCircle,numOfTrials) {
		                results.insideCircle+=insideCircle;
		                results.total+=numOfTrials;
		                finished();
		            });
		        },

		        params: {}
		    });
		}

		var combineResults = function() {
		  var piEstimate = 4*results.insideCircle/results.total;
		  var piDelta = Math.abs(Math.PI-piEstimate);
		  piDelta.should.be.below(0.01);
		  done();
		};

		var numCores = require("os").cpus().length;
		var pool = WorkerRPC.pool(numCores, combineResults);

		pool.add(workloads);
	});

	it('should work within a pool using map/reduce', function(done) {

		var numCores = require("os").cpus().length;

		var workloads = WorkerRPC.createWorkload({
			maxParallel: numCores,
			script: "./test/dep/pi.js"
		});

		workloads.add(
			[{numOfTrials:1},{numOfTrials:2},{numOfTrials:4},{numOfTrials:8}]
		);

		workloads.
		map(
			function doActualWork(workload,worker,next) {
				worker.pi(workload.numOfTrials,function(insideCircle) {
					next(null,{
						insideCircle:insideCircle,
						total:workload.numOfTrials
					});
				});
			}
		).reduce(

			//WE ARE GOING TO SUM THE RESULTS UP, STARTING AT ZERO
			{insideCircle:0,total:0},

			//CODE TO ACTUALLY ADD RESULTS
			function sumSingleWorksResults(sum, current, next) {
				sum.insideCircle+=current.insideCircle;
				sum.total+=current.total;
				next(null,sum);
			},

			//FINISHED ADDING UP, PRINT RESULTS
			function printSumAndEstimate(err,sum) {
				var piEstimate = 4*sum.insideCircle/sum.total;
				var piDelta = Math.abs(Math.PI-piEstimate);
				piDelta.should.be.below(0.01);
				done();
			}
		);


		//YOU CAN ADD WORKLOAD LATER ON
		setTimeout(function() {
			workloads.add({numOfTrials:1000000});
		},10);
	});
});
