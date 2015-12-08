/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}
console.log('>>> tasks')

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')



/*********************************************************************/

/*
var Promise = require('promise')

function PTask(fn) {
	if (!(this instanceof PTask)){
		return new PTask(fn)
	}
	Promise.call(this, fn)
}
PTask.prototype = Object.create(Promise.prototype)
PTask.prototype.constructor = PTask

PTask.prototype.spread = function (cb) {
	return this.then(function (arr) {
		return cb.apply(this, arr);
	})
}
*/



/*********************************************************************/

// XXX experimental...
// Create a task...
//
//	Task(<func>, <arg>[, ...])
//		-> <task>
//
// A task is a deferred like object that runs a function returning a 
// deferred and adds to it the ability to restart.
//
// Restarting is possible only of the original is rejected.
//
// Restarting will call the original function with the original set of 
// arguments and reset the task.
//
// XXX this depends on that func(..) will return a deferred...
// XXX restarting will not transfer the handlers...
// 		...this might be a deal breaker...
module.Task = function(func){
	var args = [].slice.call(arguments)

	// remove func from args...
	args.splice(0, 1)
	
	return ({
		restart: function(){
			// XXX jQuery compatible, need promise state check...
			if(this.isRejected == null || this.isRejected()){
				this.__proto__ = func.apply(null, args)
			}
			return this
		},
	}).restart()
}



/*********************************************************************/

module.TaskPrototype = {
}


/*********************************************************************/

var Queue = 
module.Queue = actions.Actions({
	config: {
		'running-pool-size': 8,
		// XXX at this point these is ignored...
		'retry-limit': 5,
		'default-queue-mode': 'resumable',
	},
		
	// NOTE: these are sparse...
	ready: null,
	running: null,
	done: null,
	failed: null,

	get length(){
		var lists = ['ready', 'running', 'done', 'failed']
		var sum = 0
		while(lists.length > 0){
			var l = this[lists.pop()]
			sum += l == null ? 0 : l.len 
		}
		return sum
	},
	set length(val){},

	// can be:
	// 	- running
	// 	- ready
	// 	- done
	// 	- ...
	// XXX should be more informative -- now supports only 'running' and 'stopped'
	get state(){
		return this._state || 'stopped'
	},

	// general events...
	// NOTE: these are not intended to be called by the user...
	taskQueued: ['', function(){}],
	taskUnqueued: ['', function(){}],
	taskStarted: ['', function(){}],
	taskDelayed: ['', function(){}],
	taskFailed: ['', function(){}],
	taskDone: ['', function(){}],

	// task manipulation actions...
	// NOTE: these and task events are partly redundent....
	enqueue: ['',
		function(a, b, c){
			// normalize arguments...
			if(typeof(a) == typeof('str')){
				var tag = a
				var task = b
				var mode = c
			} else {
				var tag = null
				var task = a
				var mode = b
			}
			mode = mode || this.config['default-queue-mode']
			var ready = this.ready = this.ready || []

			// XXX check if task is a task...
			// XXX else, wrap in a task...
			
			ready.push([tag, task, mode])

			// restart in case the queue was depleted...
			this._run()

			this.taskQueued(tag, task, mode)
		}],
	unqueue: ['',
		function(a, b){
			var ready = this.ready
			// empty queue...
			if(ready == null || ready.length == 0){
				return
			}

			// XXX prep args...
			var tag = typeof(a) == typeof('str') ? a : b
			var task = typeof(a) == typeof('str') ? b : a

			// no args...
			if(tag == null && task == null){
				return
			}

			// remove matching tasks from the queue...
			ready.forEach(function(e, i){
				// only tag given...
				if(task == null ? e[0] == tag
						// only task given...
						: tag == null ? e[1] === task
						// both task and tag given...
						: e[0] != tag && e[1] === task){
					delete ready[i]
				}
			})

			// XXX
			this.taskUnqueued(tag, task)
		}],
	delay: ['',
		function(a, b){
			var ready = this.ready
			// empty queue...
			if(ready == null || ready.length == 0){
				return
			}

			// XXX prep args...
			var tag = typeof(a) == typeof('str') ? a : b
			var task = typeof(a) == typeof('str') ? b : a

			// no args...
			if(tag == null && task == null){
				return
			}

			var delayed = []
			// remove the matching tasks...
			ready.forEach(function(e, i){
				// only tag given...
				var res = (task == null ? e[0] == tag
					// only task given...
					: tag == null ? e[1] === task
					// both task and tag given...
					: e[0] != tag && e[1] === task)

				if(res){
					delete ready[i]

					delayed.push(e)
				}
			})

			// push delayed list to the end of the queue...
			delayed.forEach(function(e){
				ready.push(e)
			})

			// restart in case the queue was depleted...
			this._run()

			// XXX
			this.taskDelayed(tag, task)
		}],

	// Run the queue...
	//
	// This is not intended for direct use...
	//
	// This can run in one of two ways:
	// 	1) run until the .ready queue is completely depleted
	// 		This can occur for very fast or sync tasks, essentially
	// 		each iteration will replenish the .running pool until there
	// 		are not task to run.
	// 	2) load the .running pool and exit
	// 		The first task to finish will run this again to replenish
	// 		the pool.
	//
	// NOTE: there can be no more that one instance running at a time.
	// NOTE: if .state is not 'running' this will silently exit.
	//
	// XXX need to handle retries correctly, at this point all errors just
	// 		drop to failed and retry counter is incremented, there is no
	// 		flow back to .running
	_run: ['',
		function(){
			if(this._running){
				return
			}

			var that = this
			var size = this.config['running-pool-size'] 
			this.running = this.running || []
			
			// NOTE: the function in the look here is to clock some 
			// 		values in a closure for reuse in promise state 
			// 		handlers...
			while(this.ready && this.ready.len > 0 
					&& this.state == 'running'
					&& (this.running && this.running.len || 0) < size){ (function(){
				var elem = ready.shift()
				var task = elem[0]
				that._running = true

				that.running.push(elem)

				task()
					// retry or move to failed...
					.catch(function(){
						// pop self of .running
						delete that.running[that.running.indexOf(elem)]

						// push self to .failed
						var failed = that.failed = that.failed || []

						// increment retry count...
						elem[3] = (elem[3] || 0) + 1

						// XXX check task mode and re-queue if needed...
						// XXX
						failed.push(elem)
					})
					// push to done and ._run some more...
					.then(function(){
						// pop self of .running
						delete that.running[that.running.indexOf(elem)]

						// push self to .done
						var done = that.done = that.done || []

						done.push(elem)

						// run some more...
						that._run()
					})
			})() }

			that._running = false
		}],

	// state manipulation actions...
	// NOTE: we do not need events for these as they are actions...
	start: ['',
		function(){
			this._state = 'running'
			this._run()
		}],
	stop: ['',
		function(){
			delete this._state
		}],
	clear: ['',
		function(){
			this.stop()
			delete this.ready
			delete this.running
			delete this.failed
			delete this.done
		}],
})



// XXX need to make the queue usable as an object...
// XXX


/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
