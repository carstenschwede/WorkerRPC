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
require("../lib/workerrpc").wrap({
  pi:pi
});