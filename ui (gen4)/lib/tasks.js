/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var object = require('lib/object')



/*********************************************************************/

var QueuePrototype = Object.create(actions.MetaActions)


// XXX need a mechanism to either queue chains of tasks that depend on 
// 		on the previous results or a way to delay a task until what it
// 		needs is finished...
// XXX add fatal .abort(..) of queue...
var QueueActions = 
module.QueueActions = actions.Actions(QueuePrototype, {
	config: {
		'running-pool-size': 8,
		// XXX at this point these is ignored...
		'retry-limit': 5,
		'default-queue-mode': 'resumable',

		'clear-on-done': true,
	},
		
	// NOTE: these are sparse...
	__ready: null,
	__running: null,
	__done: null,
	__failed: null,


	get length(){
		var that = this
		//return ['__ready', '__running', '__done', '__failed']
		return ['__ready', '__running']
			.reduce(function(a, b){
				return (typeof(a) == typeof(1) ? a 
						: that[a] ? that[a].len 
						: 0)
					+ (typeof(b) == typeof(1) ? b 
						: that[b] ? that[b].len 
						: 0) 
			}, 0)
	},
	set length(val){},

	// can be:
	// 	- stopped 	- (initial)
	// 	- ready		- right after .start()
	// 	- running	- while tasks are running
	//
	// 									   +-------<done>--------+
	// 									   v					 |
	// 		o---> stopped ---(start)---> ready --+--> running ---+
	// 				^							 |				 |
	// 				+--------(stop)--------------+---------------+
	//
	// NOTE: while .start() and .stop() are both actions and events, 
	// 		.done() is not an action, so it is not recommended to call 
	// 		it manually...
	//
	// XXX should be more informative -- now supports only 'running' and 'stopped'
	get state(){
		return this._state || 'stopped'
	},


	// General task life cycle events...
	//
	// NOTE: these are not intended to be called by the user...
	// NOTE: .on('taskQueued') is just a more uniform shorthand for
	// 		.on('enqueue') with one subtle difference, the former does
	// 		not "wrap" the .enqueue(..) method with .pre/.post sub events
	// 		and runs atomic as all other task events.
	taskQueued: ['', function(){}],
	// NOTE: binding to this is not the same as to .unqueue(..), this will
	// 		get triggered once per each task deleted and not per method 
	// 		call...
	taskDropped: ['', function(){}],
	taskStarted: ['', function(){}],
	taskFailed: ['', function(){}],
	taskDone: ['', function(){}],

	done: ['', function(func){
		func && this.on('done', func) }],


	// Task manipulation actions...
	//
	// A task can be either a Promise/A+ or a function. In the case of 
	// a function this will work sync.
	//
	// NOTE: these and task events are partly redundant....
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
			var ready = this.__ready = this.__ready || []

			ready.push([tag, task, mode])
			this.taskQueued(tag, task, mode)

			// restart in case the queue was depleted...
			this._run()
		}],
	unqueue: ['',
		function(a, b){
			var that = this
			var ready = this.__ready
			// empty queue...
			if(ready == null || ready.len == 0){
				return
			}

			// special case -- drop all...
			if(a == '*'){
				ready.splice(0, ready.length)
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
						: e[0] == tag && e[1] === task){
					delete ready[i]
					that.taskDropped(e[0], e[1], e[2])
				}
			})
		}],
	delay: ['',
		function(a, b){
			var ready = this.__ready
			// empty queue...
			if(ready == null || ready.len == 0){
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
		}],

	// Run the queue...
	//
	// This is not intended for direct use...
	//
	// This can run in one of two ways:
	// 	1) run until the .__ready queue is completely depleted
	// 		This can occur for very fast or sync tasks, essentially
	// 		each iteration will replenish the .__running pool until there
	// 		are no tasks to run.
	// 	2) load the .__running pool and exit
	// 		The first task to finish will run this again to replenish
	// 		the pool.
	//
	// NOTE: there can be no more than one instance running at a time.
	// NOTE: if .state is not 'running' or 'ready' this will silently exit.
	// NOTE: if .state is 'ready' this will set it to 'running' and when 
	// 		queue is depleted the .state will get set back to 'ready'
	//
	// XXX need to handle retries correctly, at this point all errors just
	// 		drop to failed and retry counter is incremented, there is no
	// 		flow back to .__running
	// XXX this shifts the .__ready, this may cause a race with .unqueue(..)
	// 		and .delay(..)
	// 		really do not like setting this up with a for in or .forEach(..)
	// 		as they will really complicate continuous operation...
	_run: ['',
		function(){
			if(this.__is_running){
				return
			}

			var that = this
			var size = this.config['running-pool-size'] 
			this.__running = this.__running || []
			
			// NOTE: the function in the look here is to clock some 
			// 		values in a closure for reuse in promise state 
			// 		handlers...
			// NOTE: we are not using .forEach(..) here because we need 
			// 		to stop at abstract places and to see the list live...
			while(this.__ready && this.__ready.len > 0 
					&& (this.state == 'running' || this.state == 'ready')
					&& (this.__running && this.__running.len || 0) < size){ (function(){

				// XXX this might race...
				var elem = that.__ready.shift()
				if(elem == null){
					return 
				}

				var task = elem[1]
				that.__is_running = true
				that._state = 'running'

				that.__running.push(elem)

				// start the task...
				// XXX should we run a task in some specific context???
				that.taskStarted(elem[0], task)
				res = task()

				// Promise/A+
				if(res && res.then){
					res
						// retry or move to failed...
						.catch(function(){
							// pop self of .__running
							delete that.__running[that.__running.indexOf(elem)]

							// push self to .__failed
							var failed = that.__failed = that.__failed || []

							// increment retry count...
							elem[3] = (elem[3] || 0) + 1

							// XXX check task mode and re-queue if needed...
							// XXX
							failed.push(elem)
							that.taskFailed(elem[0], task)

							// run some more...
							that._run()

							// queue empty...
							if(that.__ready && that.__ready.len == 0
									&& that.__running && that.__running.len == 0){
								that._state = 'ready'
								that.done()

								that.config['clear-on-done'] 
									&& that.clear()
							}
						})
						// push to done and ._run some more...
						.then(function(){
							// pop self of .__running
							delete that.__running[that.__running.indexOf(elem)]

							// push self to .__done
							var done = that.__done = that.__done || []

							done.push(elem)
							that.taskDone(elem[0], task)

							// run some more...
							that._run()

							// queue empty...
							if(that.__ready && that.__ready.len == 0
									&& that.__running && that.__running.len == 0){
								that._state = 'ready'
								that.done()

								that.config['clear-on-done']
									&& that.clear()
							}
						})

				// other...
				} else {
					// pop self of .__running
					delete that.__running[that.__running.indexOf(elem)]

					// push self to .__done
					var done = that.__done = that.__done || []

					done.push(elem)
					that.taskDone(elem[0], task)

					// queue empty...
					if(that.__ready && that.__ready.len == 0
							&& that.__running && that.__running.len == 0){
						that._state = 'ready'
						that.done()

						that.config['clear-on-done'] 
							&& that.clear()
					}
				}
			})() }

			delete that.__is_running
		}],

	// State manipulation actions...
	//
	// NOTE: we do not need events for these as they are actions...
	start: ['',
		function(){
			this._state = 'ready'
			this._run()
		}],
	stop: ['',
		function(){
			delete this._state
		}],
	clear: ['',
		function(){
			// XXX should this stop???
			this.stop()
			delete this.__ready
			delete this.__running
			delete this.__failed
			delete this.__done
		}],
})


var Queue = 
module.Queue = 
object.makeConstructor('Queue', QueueActions)



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
