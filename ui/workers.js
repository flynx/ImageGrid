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

var PROGRESS_WIDGET_CONTAINER = 'floating'



/**************************************************** Progress bar ***/

// mode can be:
// 	- null			- default
// 	- 'floating'
// 	- 'panel'
function getWorkerProgressFloatingContainer(mode, parent){
	parent = parent == null ? $('.viewer') : parent
	mode = mode == null ? PROGRESS_WIDGET_CONTAINER : mode

	if(mode == 'floating'){
		// widget container...
		var container = parent.find('.progress-container')
		if(container.length == 0){
			container = $('<div class="progress-container"/>')
				.appendTo(parent)
		}
	} else {
		var container = getPanel('Progress')
		if(container.length == 0){
			container = makeSubPanel('Progress')
				.addClass('.progress-container')
		}

		container = container.find('.content')
	}

	return container
}

// NOTE: if the progress widget gets removed without removing the worker
// 		this will result in dangling handlers for the previous widget...
// 		i.e. handlers that still reverence the original widget...
//
// XXX add a clean removal scheme...
// XXX should this have a pause button???
function getWorkerProgressBar(name, worker, container){
	container = container == null 
		? getWorkerProgressFloatingContainer() 
		: container

	var widget = $('.progress-bar[name="'+name+'"]')

	// a progress bar already exists, reset it and return...
	// XXX should we re-bind the event handlers here???
	if(widget.length > 0){
		widget
			.css('display', '')
			.find('.close')
				.css('display', '')
		widget.find('progress')
			.attr({
				value: '',
				max: '',
			})
		return worker
	}

	// fields we'll need to update...
	var state = $('<span class="state"/>')
	var bar = $('<progress/>')

	// the progress bar widget...
	var widget = $('<div class="progress-bar" name="'+name+'">'+name+'</div>')
		// progress state...
		.append(state)
		// the close button...
		.append($('<span class="close">&times;</span>')
			.click(function(){
				$(this).hide()
				WORKERS[name]
					.dropQueue()
			}))
		.append(bar)
		.appendTo(container)

	// re get the fields...
	bar = $(bar[0])
	state = $(state[0])

	worker
		.progress(function(done, total){
			bar.attr({
				value: done,
				max: total
			})
			state.text(' ('+done+' of '+total+')')
		})
		.depleted(function(done){
			bar.attr('value', done)
			state.text(' (done)')

			setTimeout(function(){
				widget.hide()
			}, 1500)
		})

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
