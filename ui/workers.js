/**********************************************************************
* 
* Deferred worker API
*
* NOTE: at this point this only contains a worker queue...
*
*
**********************************************************************/

// object to register all the worker queues...
var WORKERS = {}



/********************************************************* Workers ***/

// get/create a named worker queue...
function getWorkerQueue(name, no_auto_start){

	// create a new worker queue...
	if(WORKERS[name] == null){
		var queue = makeDeferredsQ()
		WORKERS[name] = queue
		// start if needed...
		if(!no_auto_start){
			queue.start()
		}

	// return existing worker queue...
	} else {
		var queue = WORKERS[name]
	}

	return queue
}


// kill all worker queues...
function killAllWorkers(){
	for(var k in WORKERS){
		if(WORKERS[k].isWorking()){
			console.log('Worker: Stopped:', k)
		}
		WORKERS[k].kill()
	}
	WORKERS = {}
}



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
