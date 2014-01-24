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



/**************************************************** Progress bar ***/

// NOTE: if the progress widget gets removed without removing the worker
// 		this will result in dangling handlers for the previous widget...
// 		i.e. handlers that still reverence the original widget...
//
// XXX add a clean removal scheme...
// XXX should this have a pause button???
// XXX make this understand deferred workers...
function getWorkerProgressBar(name, worker, container){
	container = container == null 
		? getProgressContainer() 
		: container

	var widget = getProgressBar(name)

	if(widget.length == 0){
		widget = progressBar(
			name, 
			container,
			function(){
				WORKERS[name].dropQueue()
			}) 

		worker
			.progress(function(done, total){
				widget.trigger('progressUpdate', [done, total])
			})
			.depleted(function(done){
				widget.trigger('progressDone', [done])
			})
	} else {
		resetProgressBar(widget)
	}

	return worker
}



/********************************************************* Workers ***/

// get/create a named worker queue...
//
// XXX rename this to something task-related.... (???)
function getWorkerQueue(name, pool_size, container, no_auto_start, no_progress){
	pool_size = pool_size == null ? 1 : pool_size

	// create a new worker queue...
	if(WORKERS[name] == null){
		var queue = makeDeferredPool(pool_size, no_auto_start)
		WORKERS[name] = queue

	// return existing worker queue...
	} else {
		var queue = WORKERS[name]
	}

	if(!no_progress){
		getWorkerProgressBar(name, queue, container)
	}

	return queue
}


// Kill all worker queues...
//
// Returns a deffered that will get resolved when all workers are 
// actually stopped...
//
// NOTE: this will not stop the already started tasks, just drop all 
// 		worker queues, thus it may take some time for workers to 
// 		actually stop...
// NOTE: if no workers are loaded or all are already done, the deferred
// 		returned will be resolved...
// NOTE: this will also kill paused workers...
function killAllWorkers(){
	var res = $.Deferred()
	var w = []

	Object.keys(WORKERS).forEach(function(k){
		if(WORKERS[k].isRunning()){
			var wd = $.Deferred()
			w.push(wd)
			WORKERS[k]
				.depleted(function(){
					console.log('Worker: Stopped:', k)
					wd.resolve()
				})
		}
		WORKERS[k]
			.dropQueue()
	})
	WORKERS = {}

	// resolve the deferred as soon as ALL the workers are done...
	$.when.apply(null, w)
		.done(function(){
			console.log('Worker: All workers stopped.')
			res.resolve()
			$('.progress-bar').remove()
		})

	return res
}



/*********************************************************************/




  
/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
