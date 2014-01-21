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
//
// XXX rename this to task-related.... (???)
function getWorkerQueue(name, pool_size, no_auto_start){
	// XXX 1 is the default for compatibility...
	pool_size = pool_size == null ? 1 : pool_size

	// create a new worker queue...
	if(WORKERS[name] == null){
		var queue = makeDeferredPool(pool_size, no_auto_start)
		WORKERS[name] = queue

	// return existing worker queue...
	} else {
		var queue = WORKERS[name]
	}

	return queue
}


// kill all worker queues...
function killAllWorkers(){
	for(var k in WORKERS){
		if(WORKERS[k].isRunning()){
			console.log('Worker: Stopped:', k)
		}
		WORKERS[k].dropQueue()
	}
	WORKERS = {}
}



/*********************************************************************/




  
/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
