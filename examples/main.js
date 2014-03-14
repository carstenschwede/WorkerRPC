
var numCores = require("os").cpus().length;

var workloads = require("../lib/workerrpc").createWorkload({
	maxParallel: numCores,
	script: "worker.js"
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
	  console.log("Estimated Pi to",piEstimate,"using",sum.total,"trials");
	}
);


//YOU CAN ADD WORKLOAD LATER ON
setTimeout(function() {
	workloads.add({numOfTrials:1000000});
},5000);