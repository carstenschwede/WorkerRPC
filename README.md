# WorkerRPC.js

WorkerRPC is a utility module for [node.js](http://nodejs.org) which allows
to distribute javascript workloads easily across multiple instances (e.g. to make use of multi-core cpus).

## Quick Examples

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

## Download

The source is available for download from
[GitHub](http://github.com/carstenschwede/workerrpc).
Alternatively, you can install using Node Package Manager (npm):

    npm install workerrpc

