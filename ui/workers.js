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
// XXX rename this to something task-related.... (???)
function getWorkerQueue(name, pool_size, no_auto_start, no_progress){
	// XXX 1 is the default for compatibility...
	pool_size = pool_size == null ? 1 : pool_size

	// XXX experimental -- STUB...
	if(!no_progress){
		var container = $('.progress-container')
		if(container.length == 0){
			container = $('<div class="progress-container"/>')
				.appendTo($('.viewer'))
		}
		var progress = $('<div class="progress-bar">'+name+'</div>')
			.appendTo(container)
		var progress_state = $('<span class="state"/>')
			.appendTo(progress)
		var progress_bar = $('<progress id="'+name+'"/>')
			.appendTo(progress)

		// XXX for some reason without this, here the progress handlers 
		// 		later lose context...
		progress = $(progress[0])
		progress_bar = $(progress_bar[0])
	}

	// create a new worker queue...
	if(WORKERS[name] == null){
		var queue = makeDeferredPool(pool_size, no_auto_start)
		WORKERS[name] = queue

		// XXX experimental...
		if(!no_progress){
			queue
				.progress(function(done, total){
					progress_bar
						.attr({
							value: done,
							max: total
						})
					progress_state
						.text(' ('+done+' of '+total+')')
				})
				.depleted(function(done){
					progress_bar
						.attr('value', done)
					progress_state
						.text(' (done)')

					setTimeout(function(){
						progress
							.remove()
					}, 1500)
				})
		}

	// return existing worker queue...
	} else {
		var queue = WORKERS[name]
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
		})

	return res
}



/*********************************************************************/




  
/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
