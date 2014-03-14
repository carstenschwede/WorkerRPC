# WorkerRPC.js

WorkerRPC is a utility module for [node.js](http://nodejs.org) which allows
to distribute javascript workloads easily across multiple instances (e.g. to make use of multi-core cpus).

## Quick Examples

Basic Worker used for examples:
```javascript
//worker.js START

//pi(num,callback) will create NUM 2D-points in [0;1[
//and count how many have distance of 1 or less to origin.
//Returns that count via callback

function pi(num,callback){
	var insideCircle = 0;
	for(var i=0;i<num;i++) {
		var p = {x:Math.random(),y:Math.random()};
		if (p.x*p.x+p.y*p.y <= 1) {
			insideCircle++;
		}
	}
	console.log("Sample Pi Run finished (" + num + " trials)");
	callback(insideCircle);
}

//add this to worker.js to expose function add
require("workerrpc").wrap({
  pi:pi
});
```

### Variant #1: Combining results via simple callbacks/RPC

```javascript
//main.js START
var numOfTrials = 1000*1000;
var results = {insideCircle:0,total:0};

var workloads = [];
for(var i = 0;i < 10; i++) {
  workloads.push({
    //filename that will be forked in a child-process with wrapped object
		script: "worker.js",
		action: function(instance,params,finished) {

  		//actual remote function to be called ("pi")
			instance.pi(numOfTrials,function(insideCircle) {
				results.insideCircle+=insideCircle;
				results.total+=numOfTrials;
				//call finished to make shure the worker is released from pool
				finished();
			});
		},

		//optional set of params to give worker
		params: {}
	});
}

//combine results once there are no more workers pending
var combineResults = function() {
  var piEstimate = 4*results.insideCircle/results.total;
  console.log("Estimated Pi to",piEstimate);
};

var numCores = require("os").cpus().length;
//create pool with maximum of numCores concurrent workers
var pool = require("workerrpc").pool(numCores, combineResults);

//add workload to pool and start working
pool.add(workloads);
//main.js END
```

### Variant #2: Combine results using map/reduce

```javascript
//main.js START
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
	  console.log("Estimated Pi to be",piEstimate,"using",sum.total,"trials");
	}
);


//YOU CAN ADD WORKLOAD LATER ON
setTimeout(function() {
	workloads.add({numOfTrials:1000000});
},5000);
//main.js END
```

## Download

The source is available for download from
[GitHub](http://github.com/carstenschwede/workerrpc).
Alternatively, you can install using Node Package Manager (npm):

    npm install workerrpc

## Test

Some basic tests are implemented using mocha.

    mocha test -R spec

You can use npm test as well:
    
    npm test
 

