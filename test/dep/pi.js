function pi(num,callback){
	var insideCircle = 0;
	for(var i=0;i<num;i++) {
		var p = {x:Math.random(),y:Math.random()};
		if (p.x*p.x+p.y*p.y <= 1) {
			insideCircle++;
		}
	}
	callback(insideCircle,num);
}

require("../../lib/workerrpc").wrap({pi: pi});