/**********************************************************************
* 
* Core features...
* 	Setup the life-cycle and the base interfaces for features to use...
*
* Defined here:
* 	- protocol action constructor
* 	- config value toggler constructor
* 	- meta actions
* 		- .isToggler(..) predicate
* 		- .preActionHandler(..) used to toggler special args
* 	- ImageGrid root object/constructor
* 	- ImageGridFeatures object
*
*
* Features:
* 	- logger
* 	- introspection
* 	- lifecycle
* 		base life-cycle events (start/stop/..)
* 		base abort api
*	- serialization
*		base methods to handle loading, serialization and cloning...
*	- cache
*		basic action/prop caching api...
*	- timers
*		wrapper around setInterval(..), setTimeout(..) and friends, 
*		provides persistent timer triggers and introspection...
* 	- util
* 	- journal
* 		action journaling and undo/redo functionality
* 		XXX needs revision...
* 	- changes
* 		change tracking
* 	- workspace
* 		XXX needs revision...
* 	- tasks
* 		XXX not yet used
* 	- self-test
* 		basic framework for running test actions at startup...
*
*
* XXX some actions use the .clone(..) action/protocol, should this be 
* 	defined here???
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

// XXX
var DEBUG = typeof(DEBUG) != 'undefined' ? DEBUG : true

var util = require('lib/util')
var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')



/*********************************************************************/

// NOTE: if no toggler state is set this assumes that the first state 
// 		is the default...
// NOTE: default states is [false, true]
var makeConfigToggler = 
module.makeConfigToggler = 
function(attr, states, a, b){

	states = states || [false, true]
	var pre = a
	// XXX is this a good default???
	//var post = b || function(action){ action != null && this.focusImage() }
	var post = b

	return toggler.Toggler(null,
		function(_, action){
			var lst = states instanceof Array ? states 
				: states instanceof Function ? states.call(this)
				: states

			// get attr path...
			var a = attr.split(/\./g)
			var cfg = a.slice(0, -1) 
				.reduce(function(res, cur){
					return res[cur] }, this.config)

			if(action == null){
				var val = cfg[a.pop()]
				return val == null ? 
					(lst[lst.indexOf('none')] || lst[0])
					: val 

			} else {
				cfg[a[a.length-1]] = action
				this.config[a[0]] = this.config[a[0]]
			}
		},
		states, pre, post)
}



/*********************************************************************/

// Root ImageGrid.viewer object constructor...
//
// This adds:
// 	- toggler as action compatibility
//
var ImageGridMetaActions =
module.ImageGridMetaActions = {
	// Test if the action is a Toggler...
	//
	isToggler: 
		actions.doWithRootAction(function(action){
			return action instanceof toggler.Toggler }),

	// Handle special cases where we need to get the action result early,
	// without calling handlers...
	//
	// These include:
	// 	- toggler action special command handling (like: '?', '??', ..)
	//
	preActionHandler: actions.doWithRootAction(function(action, name, handlers, args){
		// Special case: do not call handlers for toggler state queries...
		//
		// NOTE: if the root handler is instance of Toggler (jli) and 
		// 		the action is called with '?'/'??' as argument, then the
		// 		toggler will be called with the argument and return the
		// 		result bypassing the handlers.
		// NOTE: an action is considered a toggler only if it's base action
		// 		is a toggler (instance of Toggler), thus, the same "top"
		// 		action can be or not be a toggler in different contexts.
		//
		// For more info on togglers see: lib/toggler.js
		if(this.isToggler(name)
				&& args.length == 1 
				&& (args[0] == '?' || args[0] == '??')){
			return {
				result: handlers.slice(-1)[0].pre.apply(this, args),
			}
		}
	}),
} 
ImageGridMetaActions.__proto__ = actions.MetaActions

var ImageGrid = 
module.ImageGrid = 
	object.Constructor('ImageGrid', ImageGridMetaActions)

// Root ImageGrid feature set....
var ImageGridFeatures =
module.ImageGridFeatures = new features.FeatureSet()

// setup base instance constructor...
ImageGridFeatures.__actions__ = 
	function(){ return actions.Actions(ImageGrid()) }



//---------------------------------------------------------------------
// Setup runtime info...
// XXX add chrome-app...
// XXX add cordova...
// XXX add mobile...
// XXX add widget...

// XXX should this contain feature versions???
var runtime = ImageGridFeatures.runtime = {}

// nw or node...
if(typeof(process) != 'undefined'){
	// node...
	runtime.node = true

	// Electron...
	if(process.versions['electron'] != null){
		runtime.electron = true
		runtime.desktop = true

	// nw.js 0.13+
	} else if(typeof(nw) != 'undefined'){
		runtime.nw = true
		runtime.desktop = true

		// NOTE: jli is patching the Date object and with two separate 
		// 		instances we'll need to sync things up...
		// XXX HACK: if node and chrome Date implementations ever 
		// 		significantly diverge this will break things + this is 
		// 		a potential data leak between contexts...
		//global.Date = window.Date

		// XXX this is less of a hack but it is still an implicit
		util.patchDate(global.Date)
		util.patchDate(window.Date)

	// node...
	} else {
		// XXX patch Date...
		// XXX this will not work directly as we will need to explicitly
		// 		require jli...
		//patchDate(global.Date)
	}
}

// browser...
// NOTE: we're avoiding detecting browser specifics for as long as possible,
// 		this will minimize the headaches of supporting several non-standard
// 		versions of code...
if(typeof(window) != 'undefined'){
	runtime.browser = true
}



/*********************************************************************/
// Logger...

var LoggerActions = actions.Actions({
	config: {
		// NOTE: if set to 0 no log limit is applied...
		'log-size': 10000,
	},

	Logger: object.Constructor('BaseLogger', {
		doc: `Logger object constructor...`,

		quiet: false,

		__context: null,
		get context(){
			return this.__context || this.root.__context },

		root: null,
		get isRoot(){
			return this === this.root },

		__path: null,
		get path(){
			return (this.__path = 
				this.__path == null ? 
					[] 
					: this.__path) },
		set path(value){
			this.__path = value },

		// NOTE: if set to 0 no log limit is applied...
		// NOTE: writing to this will modify .context.config['log-size']
		// 		if a available and .__max_size otherwise...
		__max_size: null,
		get max_size(){
			return this.__max_size != null ?
				this.__max_size
				// this.context.config['log-size']
				: ((this.context || {}).config || {})['log-size'] || 10000 },
		set max_size(value){
			return this.context ?
				(this.context.config['log-size'] = value)
				: this.__max_size = value },
		// NOTE: to disable log retention in .log set this to false...
		__log: null,
		get log(){
			return this.__log === false ?
					false
				: this.__log ?
					this.__log
				: this.isRoot ?
					(this.__log = this.__log || []) 
				: this.root.log },


		// log management...
		clear: function(){
			this.log 
				&& this.log.splice(0, this.log.length) 
			return this },
		// Format log to string...
		//
		// 	Full log...
		// 	.log2str()
		// 		-> str
		//
		// 	Slice log...
		// 	.log2str(from)
		// 	.log2str(from, to)
		// 		-> str
		//
		// 	Specific item...
		// 	.log2str(date, path, status, rest)
		// 	.log2str([date, path, status, rest])
		// 		-> str
		// 		NOTE: this form does not depend on context...
		//
		//
		// NOTE: the later form is useful for filtering:
		// 		logger.log
		// 			.filter(..)
		// 			.map(logger.log2str)
		// 			.join('\n')
		//
		log2str: function(){
			return (arguments.length == 0 ?
					   (this.log || [])
					: arguments[0] instanceof Array ?
						[arguments[0]]
					: arguments.length < 2 ?
						(this.log ?
							this.log.slice(arguments[0], arguments[1])
							: [])
					: [arguments])
				.map(function([date, path, status, rest]){
					return `[${ new Date(date).getTimeStamp(true) }] ` 
						+ path.join(': ') + (path.length > 0 ? ': ' : '')
						+ status 
						+ (rest.length > 1 ? 
								':\n\t'
							: rest.length == 1 ?
								': '
							: '')
						+ rest.join(': ') })
				.join('\n') },
		print: function(...args){
			console.log(this.log2str(...args))
			return this },


		// main API...
		//
		// 	.push(str, ...)
		//
		// 	.push(str, ..., attrs)
		//
		push: function(...msg){
			attrs = typeof(msg.last()) != typeof('str') ?
				msg.pop()
				: {}
			return msg.length == 0 ?
				this
				: Object.assign(
					this.constructor(),
					attrs,
					{
						root: this.root,
						path: this.path.concat(msg),
					}) },
		pop: function(){
			return (this.root === this || this.path.length == 1) ?
				this
				: Object.assign(
					this.constructor(),
					{
						root: this.root,
						path: this.path.slice(0, -1),
					}) },

		emit: function(status, ...rest){
			// write to log...
			this.log !== false
				&& this.log.push([
					Date.now(), 
					this.path, 
					status, 
					rest])
			// maintain log size...
			this.log !== false
				&& (this.max_size > 0 
					&& this.log.length > this.max_size 
					&& this.log.splice(0, this.log.length - this.max_size))
			// call context log handler...
			this.context
				&& this.context.handleLogItem
				&& this.context.handleLogItem(this, this.path, status, ...rest)
			return this },


		__call__: function(_, status, ...rest){
			return this.emit(status, ...rest) },
		__init__: function(context){
			this.__context = context
			this.root = this 
		},
	}),

	__logger: null,
	get logger(){
		return (this.__logger = 
			this.__logger 
				|| this.Logger(this)) },

	// XXX move this to console-logger???
	handleLogItem: ['- System/',
		function(logger, path, status, ...rest){
			logger.quiet
				|| console.log(
					path.join(': ') + (path.length > 0 ? ': ' : '')
						+ status 
						+ (rest.length > 1 ? 
								':\n\t'
							: rest.length == 1 ?
								': '
							: ''), ...rest) }],
})

var Logger = 
module.Logger = ImageGridFeatures.Feature({
	title: '',

	tag: 'logger',
	depends: [],

	actions: LoggerActions,
})



//---------------------------------------------------------------------
// Introspection...

// Normalize doc strings...
// 
// This will remove indent padding from all lines in a doc string.
// 
// This is useful for documenting actions using ES6 template/multi-line
// strings and keep them sane in terms of indent...
// 
// 	Example:
// 		someAction: ['Test/Some action title',
// 			core.doc`This is an example...
// 			mult-iline...
// 			...doc string that will be normalized and look the same but`
// 			without the indent...`,
// 			function(){ ... }]
// 			
// NOTE: this will ignore the first line's indent so it can be started 
// 		right at the string start.
// 		
// XXX might be a good idea to move this to a more generic spot like lib/util.js...
var doc = module.doc = object.doc
var text = module.text = object.text


// Indicate that an action is not intended for direct use...
//
// NOTE: this will not do anything but mark the action.
var notUserCallable =
module.notUserCallable = 
function(func){
	func.__not_user_callable__ = true
	return func
}

// NOTE: this is the same as event but user-callable...
var UserEvent =
module.UserEvent = 
function(func){
	func.__event__ = true
	return func
}

// XXX rename???
var Event =
module.Event = 
function(func){
	func.__event__ = true
	return notUserCallable(func)
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var IntrospectionActions = actions.Actions({
	get useractions(){
		return this.cache('useractions', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isUserCallable.bind(this)) }) },
	get events(){
		return this.cache('events', function(d){
			return d instanceof Array ? 
				d.slice() 
				: this.actions.filter(this.isEvent.bind(this)) }) },

	isUserCallable:
		// XXX should this check only the root action or the whole set???
		// 		...in other words: can we make an action non-user-callable
		// 		anywhere other than the root action?
		// 		IMO no...
		//function(action){ 
		//	return this.getActionAttr(action, '__not_user_callable__') != true }],
		actions.doWithRootAction(function(action){
			return action.__not_user_callable__ != true }),
	isEvent: 
		actions.doWithRootAction(function(action){
			return !!action.__event__ }),

	// XXX revise... 
	getActionMode: ['- Interface/',
		doc`Get action browse mode...

		Get and action's .mode(..) method and return its result.

		Action .mode can be:
			<function>			- action method.
			<action-name>		- alias, name of action to get the
									method from.

		The action .mode(..) method is called in the context of actions.

		Basic example:
			someAction: ['Path/To/Some action',
				{mode: function(){ ... }},
				function(){
					...
				}],
			someOtherAction: ['Path/To/Some action',
				// alias
				{mode: 'someAction'},
				function(){
					...
				}],


		Usage pattern:
			// for cases where we need to define an explicit mode...
			actionModeX: ['- System/',
				{mode: function(){
					return this.actionModeX() }},
				core.notUserCallable(function(){
					return ...
				})],
			someAction: [
				// use the mode...
				{mode: 'actionModeX'},
				function(){
					...
				}],
		`,
		function(action, mode_cache){
			var m = action
			var visited = [m]
			var last

			// check cache...
			if(m in (mode_cache || {})){
				return mode_cache[m] }

			// handle aliases...
			do {
				last = m
				m = this.getActionAttr(m, 'mode')

				// check cache...
				if(m in (mode_cache || {})){
					return mode_cache[m] }

				// check for loops...
				if(m && visited[m] != null){
					m = null
					break
				}
				visited.push(m)
			} while(typeof(m) == typeof('str'))

			//return m ? m.call(this) : undefined
			return m ? 
				// no cache...
				(mode_cache == null ?
						m.call(this)
					// cache hit...
					: last in mode_cache ? 
						mode_cache[last] 
					// call check and populate cache...
					: (mode_cache[action] = 
						mode_cache[last] = 
							m.call(this)))
				: actions.UNDEFINED }],
})


var Introspection = 
module.Introspection = ImageGridFeatures.Feature({
	title: '',

	tag: 'introspection',
	depends: [
		'cache'
	],

	actions: IntrospectionActions,
})



//---------------------------------------------------------------------
// System life-cycle...

// XXX should his have state???
// 		...if so, should this be a toggler???
var LifeCycleActions = actions.Actions({
	config: {
		// if set indicates the timeput after which the application quits
		// wating for .declareReady() and forcefully triggers .ready()
		'declare-ready-timeout': 15000,
	},
	
	__stop_handler: null,
	__ready: null,
	__ready_announce_requested: null,
	__ready_announce_requests: null,

	// introspection...
	isStarted: function(){ 
		return !!this.__stop_handler },
	isStopped: function(){ 
		return !this.__stop_handler },
	isReady: function(){ 
		return !!this.__ready },
	// XXX is this the right name for this???
	get runtimeState(){
		return this.isStopped() ? 
				'stopped'
			: this.isReady() ? 
				'ready'
			: this.isStarted() ? 
				'started'
			: undefined },

	// XXX not implemented...
	// 		...this should be triggered on first run and after updates...
	setup: ['- System/',
		doc``,
		Event(function(mode){
			// System started event...
			//
			// Not intended for direct use.
		})],

	start: ['- System/', 
		doc`Start core action/event

			.start()

		This action triggers system start, sets up basic runtime, prepares
		for shutdown (stop) and handles the .ready() event.

		Attributes set here:
			.runtime		- indicates the runtime ImageGrid is running.
								this currently supports:
									node, browser, nw, unknown

		This will trigger .declareReady() if no action called 
		.requestReadyAnnounce()

		This will trigger .started() event when done.

		NOTE: .runtime attribute will not be available on the .pre handler
			phase.
		NOTE: .requestReadyAnnounce() should be called exclusively on the
			.pre handler phase as this will check and trigger the .ready()
			event before the .post phase starts.
		NOTE: handlers bound to this action/event will get called on the 
			start *event* thus handlers bound when the system is already 
			started will not get called until next start, to bind a handler 
			to the started *state* bind to 'started' / .started()
		`,
		function(){
			var that = this
			this.logger && this.logger.emit('start')

			// NOTE: jQuery currently provides no way to check if an event
			// 		is bound so we'll need to keep track manually...
			if(this.__stop_handler == null){
				var stop = this.__stop_handler = function(){ that.stop() }

			} else {
				return
			}

			// set the runtime...
			var runtime = this.runtime = ImageGridFeatures.runtime

			// nw.js...
			if(runtime.nw){
				// this handles both reload and close...
				$(window).on('beforeunload', stop)

				// NOTE: we are using both events as some of them do not
				// 		get triggered in specific conditions and some do,
				// 		for example, this gets triggered when the window's
				// 		'X' is clicked while does not on reload...
				this.__nw_stop_handler = function(){
					var w = this
					try{
						that
							// wait till ALL the handlers finish before 
							// exiting...
							.on('stop.post', function(){
								// XXX might be broken in nw13 -- test!!!
								//w.close(true)
								nw.App.quit()
							})
							.stop()

					// in case something breaks exit...
					// XXX not sure if this is correct...
					} catch(e){
						console.log('ERROR:', e)

						DEBUG || nw.App.quit()
						//this.close(true)
					}
				}
				nw.Window.get().on('close', this.__nw_stop_handler)


			// electron...
			} else if(runtime.electron){
				$(window).on('beforeunload', stop)

			// node...
			} else if(runtime.node){
				process.on('exit', stop)

			// browser...
			} else if(runtime.browser){
				$(window).on('beforeunload', stop)

			// other...
			} else {
				// XXX
				console.warn('Unknown runtime:', runtime)
			}

			// handle ready event...
			// ...if no one requested to do it.
			if(this.__ready_announce_requested == null
					|| this.__ready_announce_requested <= 0){
				// in the browser world trigger .declareReady(..) on load event...
				if(runtime.browser){
					$(function(){ that.declareReady('start') })

				} else {
					this.declareReady('start')
				}
			}

			// ready timeout -> force ready...
			this.config['declare-ready-timeout'] > 0
				&& !this.__ready_announce_timeout
				&& (this.__ready_announce_timeout = 
					setTimeout(function(){
						// cleanup...
						delete this.__ready_announce_timeout
						if((this.__ready_announce_requests || new Set()).size == 0){
							delete this.__ready_announce_requests
						}
						// force start...
						if(!this.isReady()){
							// report...
							this.logger 
								&& this.logger.push('start')
									.emit('forcing ready.')
									.emit('stalled:', 
										this.__ready_announce_requested, 
										...(this.__ready_announce_requests || []))

							// force ready...
							this.__ready = !!this.ready() 

							// cleanup...
							delete this.__ready_announce_requested
							delete this.__ready_announce_requests
						}
					}.bind(this), this.config['declare-ready-timeout']))

			// trigger the started event...
			this.started()
		}],
	started: ['- System/System started event',
		doc`
		`,
	   	Event(function(){
			// System started event...
			//
			// Not intended for direct use.
		})],

	// NOTE: it is recommended to use this protocol in such a way that
	// 		the .ready() handler would recover from a stalled 
	// 		.requestReadyAnnounce() call...
	ready: ['- System/System ready event',
		doc`Ready core event

		The ready event is fired right after start is done.

		Any feature can request to announce 'ready' itself when it is 
		done by calling .requestReadyAnnounce().
		If .requestReadyAnnounce() is called, then the caller is required
		to also call .declareReady().
		.ready() will actually be triggered only after when .declareReady()
		is called the same number of times as .requestReadyAnnounce().

		NOTE: at this point the system does not track the caller 
			"honesty", so it is the caller's responsibility to follow
			the protocol.
		`,
	   	Event(function(){
			// System ready event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			this.logger && this.logger.emit('ready')
		})],
	// NOTE: this calls .ready() once per session.
	declareReady: ['- System/Declare system ready', 
		doc`Declare ready state

			.declareReady()

		This will call .ready() but only in the following conditions:
			- .requestReadyAnnounce() has not been called.
			- .requestReadyAnnounce() has been called the same number of
				times as .declareReady()

		NOTE: this will call .ready() only once per start/stop cycle.
		`,
		function(message){
			this.__ready_announce_requested
				&& (this.__ready_announce_requested -= 1)

			message
				&& this.__ready_announce_requests instanceof Set
				&& this.__ready_announce_requests.delete(message)

			if(!this.__ready_announce_requested 
					|| this.__ready_announce_requested <= 0){
				this.__ready = this.__ready 
					|| !!this.ready() 
				delete this.__ready_announce_requested
			}
		}],
	requestReadyAnnounce: ['- System/',
		doc`Request to announce the .ready() event.

			.requestReadyAnnounce()
			.requestReadyAnnounce(message)

		This enables a feature to delay the .ready() call until it is 
		ready, this is useful for async or long stuff that can block
		or slow down the .ready() phase.

		To indicate readiness, .declareReady() should be used.

		The system will call .ready() automatically when the last 
		subscriber who called .requestReadyAnnounce() calls 
		.declareReady(), i.e. .declareReady() must be called at least
		as many times as .requestReadyAnnounce()

		The actual .ready() should never get called directly.

		NOTE: if this is called, .ready() will not get triggered 
			automatically by the system.
		`,
		function(message){
			message
				&& (this.__ready_announce_requests = 
					this.__ready_announce_requests || new Set())
				&& this.__ready_announce_requests.add(message)

			return (this.__ready_announce_requested = (this.__ready_announce_requested || 0) + 1)
		}],

	stop: ['- System/', 
		doc`Stop core action

			.stop()

		This will cleanup and unbind stop events.

		The goal of this is to prepare for system shutdown.

		NOTE: it is good practice for the bound handlers to set the 
			system to a state from which their corresponding start/ready
			handlers can run cleanly.
		`,
		function(){
			// browser...
			if(this.__stop_handler && this.runtime.browser){
				$(window).off('beforeunload', this.__stop_handler)
			}

			// nw...
			if(this.__nw_stop_handler && this.runtime.nw){
				nw.Window.get().removeAllListeners('close')
				delete this.__nw_stop_handler
			}

			// node...
			if(this.__stop_handler && this.runtime.node){
				process.removeAllListeners('exit')
			}

			delete this.__ready
			delete this.__stop_handler

			this.logger && this.logger.emit('stop')

			// trigger the stopped event...
			this.stopped()
		}],
	stopped: ['- System/System stopped event',
		doc`
		`,
	   	Event(function(){
			// System stopped event...
			//
			// Not intended for direct use.
		})],

	// XXX not implemented...
	// 		...this should be triggered before uninstall...
	cleanup: ['- System/',
		doc``,
		Event(function(){
			// System started event...
			//
			// Not intended for direct use.
		})],

	// trigger core events...
	//
	// NOTE: we do not need to do .one(..) as it is implemented via .on(..)
	//
	// XXX EXPERIMENTAL...
	// 		...should this be an action???
	on: ['- System/',
		function(evt, ...rest){
			var func = rest.slice().pop()
			evt = typeof(evt) == typeof('') ? evt.split(/\s/g) : evt

			// we trigger the handler AFTER it is registered...
			return function(){
				// started...
				Math.max(
						evt.indexOf('started'), 
						evt.indexOf('started.pre'), 
						evt.indexOf('started.post')) >= 0 
					&& this.isStarted()
					&& func.call(this)

				// ready...
				// NOTE: we are ignoring the '.pre' events here as we are already
				// 		in the specific state... 
				Math.max(
						evt.indexOf('ready'), 
						evt.indexOf('ready.post')) >= 0 
					&& this.isReady()
					&& func.call(this)

				// started...
				Math.max(
						evt.indexOf('stopped'), 
						evt.indexOf('stopped.pre'), 
						evt.indexOf('stopped.post')) >= 0 
					&& this.isStopped()
					&& func.call(this)
			}
		}],

	// helpers...
	restart: ['System/Soft restart',
		doc`Soft restart

		This will stop, clear and then start ImageGrid.
		`,
		function(){
			this
				.stop()
				.clear()
				.start() }],


})

var LifeCycle = 
module.LifeCycle = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'lifecycle',
	suggested: [
		'logger',
	],
	priority: 'high',

	actions: LifeCycleActions,
})


//---------------------------------------------------------------------
// Serialization...

var SerializationActions = actions.Actions({
	clone: ['- System/',
		function(full){ return actions.MetaActions.clone.call(this, full) }],
	json: ['- System/',
		function(){ return {} }],
	load: ['- System/',
		function(data, merge){ !merge && this.clear() }],
	clear: ['- Sustem/',
		function(){ }],
})

var Serialization = 
module.Serialization = ImageGridFeatures.Feature({
	title: '',

	tag: 'serialization',

	actions: SerializationActions,
})


//---------------------------------------------------------------------
// Cache...
	
// XXX should this be in actions.js???
// XXX should we invalidate the cache automatically???
// XXX the cache can also be saved to localStorage and loaded until either
// 		the version changes or the feature list...
var CacheActions = actions.Actions({
	config: {
		// Enable/disable caching...
		'cache': true,

		// Control pre-caching...
		//
		// This can be:
		// 		true	- sync pre-cache (recursion)
		// 		0		- semi-sync pre-cache
		// 		number	- delay in milliseconds between pre-cache chunks
		// 		false	- pre-caching disabled
		'pre-cache': 0,

		// Cache chunk length in ms...
		//
		// Caching is done in a series of chunks set by this separated by 
		// timeouts set by .config['pre-cache'] to let other stuff run...
		'pre-cache-chunk': 8,

		// Control pre-cache progress display...
		//
		// This can be:
		// 	false		- never show progress
		// 	true		- always show progress
		// 	number		- show progress if number of milliseconds has 
		// 					passed and we are not done yet...
		//
		// NOTE: progress will only be displayed if .showProgress(..) 
		// 		action is available...
		'pre-cache-progress': 3000,

		// XXX handler cache..
	},

	// Cache utility method...
	//
	// Example use:
	// 	someAction: [
	// 		function(){
	// 			return this.cache('someAction', 
	// 				function(data){
	// 					if(data){
	// 						// clone/update the data...
	// 						// NOTE: this should be faster than the construction
	// 						//		branch below or this will defeat the purpose 
	// 						//		of caching...
	// 						...
	//
	// 					} else {
	// 						// get the data...
	// 						...
	// 					}
	// 					return data
	// 				}) }],
	//
	cache: function(title, lister){
		if(!(this.config || {}).cache){
			return lister.call(this)
		}
		var cache = this.__cache = this.__cache || {}
		return (cache[title] = 
			title in cache ? 
				// pass the cached data for cloning/update to the lister...
				lister.call(this, cache[title])
				: lister.call(this))
	},

	preCache: ['System/Run pre-cache',
		doc`Run pre-cache...

			Do an async pre-cache...
			.preCache()

			Do a sync pre-cache...
			.preCache(true)

		NOTE: both "modes" of doing a pre-cache run in the main thread,
			the difference is that the "async" version lets JS run frames
			between processing sync chunks...
		NOTE: this will not drop the existing cache, to do this run 
			.clearCache() first or run .reCache(..).
		`,
		function(t){
			if(this.config.cache){
				var t = t || this.config['pre-cache'] || 0
				var c = this.config['pre-cache-chunk'] || 8
				var done = 0
				var attrs = []
				for(var k in this){
					attrs.push(k)
				}
				var l = attrs.length

				var started = Date.now()
				var show = this.config['pre-cache-progress']

				var tick = function(){
					var a = Date.now()
					var b = a
					if(attrs.length == 0){
						return
					}

					while(b - a < c){
						this[attrs.pop()]
						b = Date.now()
						done += 1

						this.showProgress
							&& (show === true || (show && b - started > show))
							&& this.showProgress('Caching', done, l)
					}

					t === true ?
						tick()
						: setTimeout(tick, t)
				}.bind(this)

				tick()
			}
		}],
	clearCache: ['System/Clear cache',
		function(title){
			if(title){
				delete (this.__cache|| {})[title]

			} else {
				delete this.__cache
			}
		}],

	// XXX do we need this...
	reCache: ['System/Re-cache',
		function(t){
			this
				.clearCache()
				.preCache(t) }],


	toggleHandlerCache: ['System/Action handler cache',
		makeConfigToggler('action-handler-cache', 
			['off', 'on']/*,
			function(state){}*/)],
	resetHanlerCache: ['System/Reset action handler cache',
		function(){
			delete this.__handler_cache }],
})

var Cache = 
module.Cache = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'cache',
	// NOTE: we use .showProgress(..) of 'ui-progress' but we do not 
	// 		need it to work, thus we do not declare it as a dependency...
	//depends: [],

	actions: CacheActions,

	handlers: [
		['start.pre', 
			function(){ 
				var t = this.config['pre-cache']
				t === true ?
					this.preCache('now') 
				: t >= 0 ?
					this.preCache() 
				: false
			}],
		['start',
			function(){
				// XXX this breaks loading...
				// 		...not sure why, but when switched on manually 
				// 		there seems to be no problems...
				//this.toggleHandlerCache(this.config['action-handler-cache'] || 'on')
			}],

		/*/ XXX clear cache when feature/action topology changes...
		[[
			'inlineMixin',
			'inlineMixout',

			// XXX not sure about this...
			'mixout',
		],
			function(){
				// XXX should this trigger a recache???
				this.clearCache()
			}],
		//*/
	],
})



//---------------------------------------------------------------------
// Timers...

// Create a debounced action...
//
// 	debounce(<func>)
// 	debounce(<timeout>, <func>)
// 	debounce(<options>, <func>)
// 		-> function
//
// options format:
// 	{
// 		timeout: number,
// 		returns: 'cached' | 'dropped',
// 		callback: function(retriggered, args),
// 	}
//
var debounce =
module.debounce =
function(options, func){
	// parse args...
	var args = [...arguments]
	func = args.pop()
	options = args.pop() || {} 

	if(typeof(options) == typeof(123)){
		options.timeout = options
	}

	// closure state...
	var res = undefined
	var debounced = false
	var retriggered = 0

	var f = function(...args){
		if(!debounced){
			res = func instanceof Function ?
				func.call(this, ...args)
				// alias...
				: this.parseStringAction.callAction(this, func, ...args)
			res = options.returns != 'cahced' ? res : undefined

			// start the timer...
			debounced = setTimeout(
				function(){
					// callback...
					options.callback instanceof Function
						&& options.callback.call(this, retriggered, args)

					// cleanup...
					retriggered = 0
					res = undefined
					debounced = false
				}.bind(this), 
				options.timeout 
					|| this.config['debounce-action-timeout'] 
					|| 200)

		} else {
			retriggered++
			return res
		}
	}

	f.toString = function(){
		return `// debounced...\n${
			doc([ func instanceof Function ? func.toString() : func ])}`
	}

	return f
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var TimersActions = actions.Actions({
	config: {
		//
		// Format:
		// 	{
		// 		<id>: {
		// 			// action code (string)...
		// 			action: <action>,
		// 			// interval in milliseconds...
		// 			ms: <ms>,
		// 		},
		// 		...
		// 	}
		'persistent-intervals': null,


		// A timeout to wait between calls to actions triggered via 
		// .debounce(..)
		'debounce-action-timeout': 200,
	},

	// XXX should we store more metadata (ms?) and provide introspection 
	// 		for these???
	__timeouts: null,
	__intervals: null,
	__persistent_intervals: null,


	// Introspection...
	//
	// NOTE: these are not editable...
	get timeouts(){
		return Object.assign({}, this.__timeouts || {}) },
	get intervals(){
		return {
			volatile: Object.assign({}, this.__intervals || {}),
			persistent: JSON.parse(JSON.stringify(
				this.config['persistent-intervals'] || {})),
		} },

	// XXX should these be  actions???
	isTimeout: function(id){
		return id in (this.__timeouts || {}) },
	isInterval: function(id){
		return id in (this.__intervals || {}) },
	isPersistentInterval: function(id){
		return id in (this.config['persistent-intervals'] || {}) },
	isPersistentIntervalActive: function(id){
		return this.isPersistentInterval(id) 
			&& (id in (this.__persistent_intervals || {})) },
	isTimer: function(id){
		return this.isInterval(id) 
			|| this.isPersistentInterval(id)
			|| this.isTimeout(id) },


	// General API...
	// 
	// NOTE: we are not trying to re-implement the native scheduler here
	// 		just extend it and unify it's uses...
	setTimeout: ['- System/', 
		function(id, func, ms){
			var timeouts = this.__timeouts = this.__timeouts || {}

			this.clearTimeout(id)

			timeouts[id] = setTimeout(
				function(){
					// cleanup...
					// NOTE: we are doing this before we run to avoid 
					// 		leakage due to errors...
					delete timeouts[id]

					// run...
					func instanceof Function ? 
						func.call(this) 
						: this.call(func)
				}.bind(this),
				ms || 0)
		}],
	clearTimeout: ['- System/',
		function(id){
			var timeouts = this.__timeouts = this.__timeouts || {}
			clearTimeout(timeouts[id])
			delete timeouts[id]	
		}],

	setInterval: ['- System/',
		function(id, func, ms){
			var intervals = this.__intervals = this.__intervals || {}

			id in  intervals
				&& clearInterval(intervals[id])

			intervals[id] = setInterval(
				(func instanceof Function ? func : function(){ this.call(func) })
					.bind(this),
				ms || 0)
		}],
	clearInterval: ['- System/',
		function(id){
			var intervals = this.__intervals = this.__intervals || {}
			clearInterval(intervals[id])
			delete intervals[id]	
		}],

	setPersistentInterval: ['- System/',
		doc`

			Restart interval id...
			.setPersistentInterval(id)

			Save/start interval id...
			.setPersistentInterval(id, action, ms)

		`,
		function(id, action, ms){
			var intervals = 
				this.__persistent_intervals = 
					this.__persistent_intervals || {}
			// NOTE: we set this later iff we make a change...
			var cfg = this.config['persistent-intervals'] || {}

			// get defaults...
			action = action ? action : cfg[id].action
			ms = ms ? ms : cfg[id].ms

			// checks...
			if(!ms || !action){
				console.error('Persistent interval: both action and ms must be set.')
				return
			}
			if(typeof(action) != typeof('str')){
				console.error('Persistent interval: handler must be a string.')
				return
			}

			id in  intervals
				&& clearInterval(intervals[id])

			this.config['persistent-intervals'] = cfg
			cfg[id] = {
				action: action, 
				ms: ms,
			}

			intervals[id] = setInterval(
				function(){ this.call(action) }.bind(this), 
				ms || 0)
		}],
	clearPersistentInterval: ['- System/',
		function(id, stop_only){
			var intervals = 
				this.__persistent_intervals = 
					this.__persistent_intervals || {}
			clearInterval(intervals[id])
			delete intervals[id]	
			if(!stop_only){
				delete this.config['persistent-intervals'][id]
			}
		}],
	// XXX revise name (???)
	// XXX do we need actions other than start/stop ???
	persistentIntervals: ['- System/',
		doc`

			Start/restart all persistent interval timers...
			.persistentIntervals('start')
			.persistentIntervals('restart')

			Stop all persistent interval timers...
			.persistentIntervals('stop')
		
		NOTE: 'start' and 'restart' are the same, both exist for mnemonics.
		`,
		function(action){
			var ids = Object.keys(this.config['persistent-intervals'] || {})

			// start/restart...
			;(action == 'start' || action == 'restart') ?
				ids.forEach(function(id){
					this.setPersistentInterval(id) }.bind(this))
			// stop...
			: action == 'stop' ?
				ids.forEach(function(id){
					this.clearPersistentInterval(id, true) }.bind(this))
			// unknown action...
			: console.error('persistentIntervals: unknown action:', action)
		}],

	// Events...
	//
	// XXX should these be "aligned" to real time???
	// 		...i.e. everyHour is triggered on the XX:00:00 and not relative
	// 		to start time?
	// XXX should we macro these???
	/*/ XXX would be nice to trigger these ONLY if there are handlers...
	everySecond: ['- System/',
		Event(function(){
			// XXX
		})],
	//*/
	everyMinute: ['- System/',
		Event(function(){
			// XXX
		})],
	every2Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every5Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every10Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	every30Minutes: ['- System/',
		Event(function(){
			// XXX
		})],
	everyHour: ['- System/',
		Event(function(){
			// XXX
		})],


	// Action debounce...
	//
	debounce: ['- System/',
		doc`Debounce action call...

		Debouncing prevents an action from being called more than once 
		every timeout milliseconds.

			Debounce call an action...
			.debounce(action, ...)
			.debounce(timeout, action, ...)
			.debounce(tag, action, ...)
			.debounce(timeout, tag, action, ...)

			Debounce call a function...
			.debounce(tag, func, ...)
			.debounce(timeout, tag, func, ...)

			Generic debounce:
			.debounce(options, action, ...)
			.debounce(options, func, ...)

		options format:
			{
				// debounce timeout...
				timeout: <milliseconds>,

				// tag to group action call debouncing (optional)
				tag: <string>,

				// controls how the return value is handled:
				// 	'cached'	- during the timeout the first return value
				// 					is cached and re-returned on each call
				// 					during the timeout.
				// 	'dropped'	- all return values are ignored/dropped
				//
				// NOTE: these, by design, enable only stable/uniform behavior
				// 		without introducing any special cases and gotchas...
				returns: 'cached' | 'dropped',

				// if true the action will get retriggered after the timeout
				// is over but only if it was triggered during the timeout...
				//
				// NOTE: if the action is triggered more often than timeout/200
				// 		times, then it will not retrigger, this prevents an extra 
				// 		call after, for example, sitting on a key and triggering
				// 		key repeat...
				retrigger: <bool>,

				// a function, if given will be called when the timeout is up.
				callback: function(<retrigger-count>, <args>),
			}

		NOTE: when using a tag, it must not resolve to and action, i.e.
			this[tag] must not be callable...
		NOTE: this ignores action return value and returns this...
		NOTE: this uses core.debounce(..) adding a retrigger option to it...
		`,
		function(...args){
			// parse the args...
			if(!(args[0] instanceof Function 
					|| typeof(args[0]) == typeof(123)
					|| typeof(args[0]) == typeof('str'))){
				var options = args.shift()
				var tag = options.tag || args[0].name || args[0]

			} else {
				var options = {
					timeout: typeof(args[0]) == typeof(123) ?
						args.shift()
						: (this.config['debounce-action-timeout'] || 200),
				}

				// NOTE: this[tag] must not be callable, otherwise we treat it
				// 		as an action...
				var tag = (args[0] instanceof Function 
						|| this[args[0]] instanceof Function) ? 
					args[0] 
					: args.shift()
			}

			// sanity check: when debouncing a function a tag is required...
			if(tag instanceof Function){
				throw new TypeError('debounce: when passing a function a tag is required.')
			}

			var action = args.shift()
			var attr = '__debounce_'+ tag

			options = Object.assign(Object.create(options), {
				callback: function(retriggered, args){
					// cleanup...
					delete this[attr]

					// call the original callback...
					options.__proto__.callback
						&& options.__proto__.callback.call(that, ...args)

					if(options.retrigger 
							&& retriggered > 0 
							// this prevents an extra action after "sitting" 
							// on the keyboard and triggering key repeat...
							&& retriggered < (options.timeout || 200) / 200){
						var func = this[attr] = this[attr] || debounce(options, action)
						func.call(this, ...args)
					}
				},
			})

			var func = this[attr] = this[attr] || debounce(options, action)

			return func.call(this, ...args)
		}],
})

var Timers = 
module.Timers = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'timers',
	depends: [
	],

	actions: TimersActions,

	handlers: [
		// start persistent timers...
		// XXX should this be start or ready???
		['start', 
			function(){ this.persistentIntervals('start') }],
		// stop all timers...
		['stop', 
			function(){ 
				Object.keys(this.__intervals || {})
					.forEach(function(id){ this.clearInterval(id) }.bind(this))
				Object.keys(this.__timeouts || {})
					.forEach(function(id){ this.clearTimeout(id) }.bind(this))

				this.persistentIntervals('stop') 
			}],

		// fixed timer actions...
		// XXX not sure about these...
		['start',
			function(){
				var m = 1000*60
				this
					.setInterval('everyMinute', 'everyMinute', m)
					.setInterval('every2Minutes', 'every2Minutes', m*2)
					.setInterval('every5Minutes', 'every5Minutes', m*5)
					.setInterval('every10Minutes', 'every10Minutes', m*10)
					.setInterval('every30Minutes', 'every30Minutes', m*30)
					.setInterval('everyHour', 'everyHour', m*60)
			}],
	],
})


//---------------------------------------------------------------------
// Util...

var UtilActions = actions.Actions({
	mergeConfig: ['- System/', 
		doc`Merge a config object into .config
		`,
		function(config){
			config = config instanceof Function ? config.call(this)
				: typeof(config) == typeof('str') ? this.config[config]
				: config
			Object.assign(this.config, config)
		}],
})

var Util = 
module.Util = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'util',

	actions: UtilActions,
})


//---------------------------------------------------------------------
// Journal...
//
// This feature logs actions that either have the journal attribute set 
// to true or have an undo method/alias...
// 
//	Example:
// 		someAction: ['Path/to/Some action',
// 			// just journal the action, but it can't be undone...
// 			{journal: true},
// 			function(){ 
// 				... 
// 			}],
//
// 		otherAction: ['Path/to/Other action',
// 			// journal and provide undo functionality...
// 			{undo: function(){ 
// 				...
// 			}},
// 			function(){ 
// 				... 
// 			}],
//
// 		someOtherAction: ['Path/to/Some other action',
// 			// use .otherAction(..) to undo...
// 			{undo: 'otherAction'},
// 			function(){ 
// 				... 
// 			}],
//
// NOTE: .undo has priority over .journal, so there is no point of 
// 		defining both .journal and .undo action attributes, one is 
// 		enough.
//
//

// XXX would be great to add a mechanism define how to reverse actions...
// 		...one way to do this at this point is to revert to last state
// 		and re-run the journal until the desired event...
// XXX need to define a clear journaling strategy in the lines of:
// 		- save state clears journal and adds a state load action
// 		- .load(..) clears journal
// XXX need a way to store additional info in the journal...
// 		can either be done as: 
// 			- a hook (action handler and/or attr)
// 			- inline code inside the action...
//		can't say I like #2 as it will mess the code up...
// XXX needs careful testing...
var JournalActions = actions.Actions({

	clone: [function(full){
			return function(res){
				res.rjournal = null
				res.journal = null
				if(full && this.hasOwnProperty('journal') && this.journal){
					res.journal = JSON.parse(JSON.stringify(this.journal))
				}
			}
		}],

	journal: null,
	rjournal: null,

	journalable: null,

	// XXX doc supported attrs:
	// 		undo
	// 		undoable
	//		getUndoState
	// XXX should the action have control over what gets journaled and how???
	// XXX should aliases support explicit undo???
	updateJournalableActions: ['System/Update list of journalable actions',
		doc`
		
		NOTE: action aliases can not handle undo.
		`,
		function(){
			var that = this

			var handler = function(action){
				return function(){
					var cur = this.current
					var args = [...arguments]

					var data = {
						type: 'basic',

						action: action, 
						args: args,
						// the current image before the action...
						current: cur, 
						// the target (current) image after action...
						target: this.current, 
					}

					// test if we need to journal this action signature...
					var test = that.getActionAttr(action, 'undoable')
					if(test && !test.call(that, data)){
						return
					}

					// get additional undo state...
					var update = that.getActionAttr(action, 'getUndoState')
					while(typeof(update) == typeof('str')){
						update = that.getActionAttr(update, 'getUndoState')
					}
					update 
						&& update instanceof Function
						&& update.call(that, data)

					// journal after the action is done...
					return function(){ this.journalPush(data) }
				}
			}

			this.journalable = this.actions
				.filter(function(action){
					// skip aliases...
					return !(that[action] instanceof actions.Alias)
						&& (!!that.getActionAttr(action, 'undo') 
							|| !!that.getActionAttr(action, 'journal'))
				})
				// reset the handler
				.map(function(action){
					that
						.off(action+'.pre', 'journal-handler')
						.on(action+'.pre', 'journal-handler', handler(action))
					return action
				})
		}],

	journalPush: ['- System/Journal/Add an item to journal',
		function(data){
			// clear the reverse journal...
			this.rjournal
				&& (this.rjournal = null)

			this.journal = (this.hasOwnProperty('journal') || this.journal) ? 
				this.journal || []
				: []
			this.journal.push(data)
		}],
	clearJournal: ['System/Journal/Clear the action journal',
		function(){
			// NOTE: overwriting here is better as it will keep
			// 		shadowing the parent's .journal in case we 
			// 		are cloned.
			// NOTE: either way this will have no effect as we 
			// 		only use the local .journal but the user may
			// 		get confused...
			//delete this.journal
			this.journal
				&& (this.journal = null)
			this.rjournal
				&& (this.rjournal = null)
		}],
	runJournal: ['- System/Journal/Run journal',
		//{journal: true},
		function(journal){
			var that = this
			journal.forEach(function(e){
				// load state...
				that
					.focusImage(e.current)
					// run action...
					[e.action].apply(that, e.args)
			})
		}],

	// XXX needs very careful revision...
	// 		- should this be thread safe??? (likely not)
	// 		- should the undo action have side-effects on the 
	// 			journal/rjournal or should we clean them out??? 
	// 			(currently cleaned)
	// XXX should we control what gets pushed to the journal???
	// XXX should we run undo of every action that supports it in the chain???
	// 		...i.e. multiple extending actions can support undo
	// 		XXX will also need to handle aliases in chain...
	undo: ['Edit/Undo',
		doc`Undo last action from .journal that can be undone

			.undo()

		This will shift the action from .journal to .rjournal preparing 
		it for .redo()

		NOTE: this will remove all the non undoable actions from the 
			.journal up until and including the undone action.
		NOTE: only the undone action is pushed to .rjournal
		`,
		{mode: function(){ 
			return (this.journal && this.journal.length > 0) || 'disabled' }},
		function(){
			var journal = this.journal.slice() || []

			var rjournal = this.rjournal = 
				(this.hasOwnProperty('rjournal') || this.rjournal) ? 
					this.rjournal || [] 
					: []

			for(var i = journal.length-1; i >= 0; i--){
				var a = journal[i]

				// see if the action has an explicit undo attr...
				var undo = this.getActionAttr(a.action, 'undo')

				// general undo...
				if(undo){
					// restore focus to where it was when the action 
					// was called...
					this.focusImage(a.current)

					// call the undo method/action...
					// NOTE: this is likely to have side-effect on the 
					// 		journal and maybe even rjournal...
					// NOTE: these side-effects are cleaned out later.
					var undo = undo instanceof Function ?
							// pass the action name...
							undo.call(this, a)
						: typeof(undo) == typeof('str') ? 
							// XXX pass journal structure as-is... (???)
							this[undo].apply(this, a.args)
						: null

					// push the undone command to the reverse journal...
					rjournal.push(journal.splice(i, 1)[0])

					// restore journal state...
					// NOTE: calling the undo action would have cleared
					// 		the rjournal and added stuff to the journal
					// 		so we will need to restore things...
					this.journal = journal
					this.rjournal = rjournal

					break
				}
			}
		}],
	redo: ['Edit/Redo',
		doc`Redo an action from .rjournal

			.redo()

		Essentially this will remove and re-run the last action in .rjournal
		`,
		{mode: function(){ 
			return (this.rjournal && this.rjournal.length > 0) || 'disabled' }},
		function(){
			if(!this.rjournal || this.rjournal.length == 0){
				return
			}

			this.runJournal([this.rjournal.pop()])
		}],
})


var Journal = 
module.Journal = ImageGridFeatures.Feature({
	title: 'Action Journal',

	tag: 'journal',
	depends: [
		'serialization',
	],

	actions: JournalActions,

	// XXX need to drop journal on save...
	// XXX rotate/truncate journal???
	// XXX need to check that all the listed actions are clean -- i.e.
	// 		running the journal will produce the same results as user 
	// 		actions that generated the journal.
	handlers: [
		// log state, action and its args... 
		['start',
			function(){ this.updateJournalableActions() }],
	],
})



//---------------------------------------------------------------------
// Changes API... 

var ChangesActions = actions.Actions({
	// This can be:
	// 	- null/undefined	- write all
	// 	- true				- write all
	// 	- false				- write nothing
	// 	- {
	//		// write/skip data...
	//		data: <bool>,
	//
	//		// write/skip images or write a diff including the given 
	//		// <gid>s only...
	//		images: <bool> | [ <gid>, ... ],
	//
	//		// write/skip tags...
	//		tags: <bool>,
	//
	//		// write/skip bookmarks...
	//		bookmarked: <bool>,
	//
	//		// write/skip selected...
	//		selected: <bool>,
	//
	//		// feature specific custom flags...
	//		...
	// 	  }
	//
	// NOTE: in the complex format all fields ar optional; if a field 
	// 		is not included it is not written (same as when set to false)
	// NOTE: .current is written always.
	//
	// XXX this should be a prop to enable correct changes tracking via 
	// 		events...
	chages: null,

	get _changes(){
		return this.__changes },
	// XXX proxy to .markChanged(..)
	set _changes(value){},

	clone: [function(full){
			return function(res){
				res.changes = null
				if(full && this.hasOwnProperty('changes') && this.changes){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}
		}],

	// XXX this should also track .changes...
	// 		...would also need to make this applicable to changes, 
	// 		i.e. x.markChanged(x.changes)
	markChanged: ['- System/',
		doc`Mark data sections as changed...

			Mark everything changed...
			.markChanged('all')

			Mark nothing changed...
			.markChanged('none')

			Mark section(s) as changed...
			.markChanged(<section>)
			.markChanged(<section>, ..)
			.markChanged([<section>, ..])

			Mark item(s) of section as changed...
			.markChanged(<section>, [<item>, .. ])
				NOTE: items must be strings...

		NOTE: when marking section items, the new items will be added to
			the set of already marked items.
		NOTE: when .changes is null (i.e. everything changed, marked via
			.markChanged('all')) then calling this with anything other 
			than 'none' will have no effect.
		`,
		function(section, items){
			var that = this
			var args = section instanceof Array ? 
				section 
				: [...arguments]
			//var changes = this.changes = 
			var changes = 
				this.hasOwnProperty('changes') ?
					this.changes || {}
					: {}

			// all...
			if(args.length == 1 && args[0] == 'all'){
				this.changes = true

			// none...
			} else if(args.length == 1 && args[0] == 'none'){
				this.changes = false 

			// everything is marked changed, everything will be saved
			// anyway...
			// NOTE: to reset this use .markChanged('none') and then 
			// 		manually add the desired changes...
			} else if(this.changes == null){
				return

			// section items...
			} else if(items instanceof Array) {
				if(changes[section] === true){
					return
				}
				changes[section] = (changes[section] || [])
					.concat(items)
					.unique()
				this.changes = changes

			// section(s)...
			} else {
				args.forEach(function(arg){
					changes[arg] = true
				})
				this.changes = changes
			}
		}],
})


var Changes = 
module.Changes = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'changes',
	depends: [
		'serialization',
	],

	actions: ChangesActions,

	handlers: [
		// handle changes...
		['json',
			function(res, mode){
				if(this.changes != null){
					res.changes = JSON.parse(JSON.stringify(this.changes))
				}
			}],
		['load',
			function(_, data){
				if(data.changes){
					this.changes = JSON.parse(JSON.stringify(data.changes))
				}
			}],
	],
})



//---------------------------------------------------------------------
// Workspace...
//
// Basic protocol:
// 	A participating feature should:
// 	- react to .saveWorkspace(..) by saving it's relevant state data to the 
// 		object returned by the .saveWorkspace() action.
// 		NOTE: it is recommended that a feature save its relevant .config
// 			data as-is.
// 		NOTE: no other action or state change should be triggered by this.
// 	- react to .loadWorkspace(..) by loading it's state from the returned
// 		object...
// 		NOTE: this can be active, i.e. a feature may call actions when 
// 			handling this.
// 	- react to .toggleChrome(..) and switch on and off the chrome 
// 		visibility... (XXX)
//
//


// Helpers...
var makeWorkspaceConfigWriter =
module.makeWorkspaceConfigWriter = function(keys, callback){
	return function(workspace){
		var that = this

		var data = keys instanceof Function ? keys.call(this) : keys

		// store data...
		data.forEach(function(key){
			workspace[key] = JSON.parse(JSON.stringify(that.config[key]))
		})

		callback && callback.call(this, workspace)
	}
}

// XXX should this delete a prop if it's not in the loading workspace???
// XXX only replace a prop if it has changed???
// XXX handle defaults -- when a workspace was just created...
var makeWorkspaceConfigLoader =
module.makeWorkspaceConfigLoader = function(keys, callback){
	return function(workspace){
		var that = this

		var data = keys instanceof Function ? keys.call(this) : keys

		// load data...
		data.forEach(function(key){
			// the key exists...
			if(key in workspace){
				that.config[key] = JSON.parse(JSON.stringify(workspace[key]))

			// no key set...
			// XXX is this the right way to go???
			} else {
				delete that.config[key]
			}
		})

		callback 
			&& callback.call(this, workspace)
	}
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX need a way to handle defaults...
var WorkspaceActions = actions.Actions({
	config: {
		'load-workspace': 'default',

		'workspace': 'default',
		'workspaces': {},
	},

	get workspace(){
		return this.config.workspace },
	set workspace(value){
		this.loadWorkspace(value) },

	get workspaces(){
		return this.config.workspaces },

	getWorkspace: ['- Workspace/',
		function(){ return this.saveWorkspace(null) }],

	// NOTE: these are mainly triggers for other features to save/load
	// 		their specific states...
	// NOTE: handlers should only set data on the workspace object passively,
	// 		no activity is recommended.
	// NOTE: if null is passed this will only get the data, but will 
	// 		save nothing. this us useful for introspection and temporary
	// 		context storage.
	//
	// XXX for some reason this does not get saved with .config...
	saveWorkspace: ['Workspace/Save Workspace',
		function(name){
			if(!this.config.hasOwnProperty('workspaces')){
				this.config['workspaces'] = JSON.parse(JSON.stringify(this.config['workspaces']))
			}

			var res = {}

			if(name !== null){
				this.config['workspaces'][name || this.config.workspace] = res
			}

			return res
		}],
	// NOTE: merging the state data is the responsibility of the feature
	// 		...this is done so as not to restrict the feature to one 
	// 		specific way to do stuff...
	loadWorkspace: ['Workspace/Load Workspace',
		function(name){
			name = name || this.config.workspace

			// get a workspace by name and load it...
			if(typeof(name) == typeof('str')){
				this.config.workspace = name

				return this.workspaces[name] || {}

			// we got the workspace object...
			} else {
				return name
			}
		}],

	// NOTE: this will not save the current workspace...
	toggleWorkspace: ['Workspace/workspace',
		makeConfigToggler('workspace',
			function(){ return Object.keys(this.config['workspaces']) },
			function(state){ this.loadWorkspace(state) })],

	// XXX should we keep the stack unique???
	pushWorkspace: ['- Workspace/',
		function(name){
			name = name || this.workspace
			var stack = this.__workspace_stack = this.__workspace_stack || []

			this.saveWorkspace()

			if(stack.slice(-1)[0] == name){
				return
			}

			this.workspace != name && this.loadWorkspace(name)
			stack.push(name)
		}],
	popWorkspace: ['- Workspace/',
		function(){
			var stack = this.__workspace_stack

			if(!stack || stack.length == 0){
				return
			}

			this.saveWorkspace()
			this.loadWorkspace(stack.pop())
		}],
})


var Workspace = 
module.Workspace = ImageGridFeatures.Feature({
	title: '',

	tag: 'workspace',

	depends: [
		'lifecycle',
	],

	actions: WorkspaceActions,

	handlers: [
		['start', 
			function(){ 
				this.loadWorkspace(this.config['load-workspace'] || 'default') }],
		// NOTE: this needs to be done before the .config is saved...
		['stop.pre', 
			function(){ 
				this.saveWorkspace() }],
	],
})



//---------------------------------------------------------------------
// Tasks...
// XXX we need:
// 		- serialize/restore
//
// XXX should this be a separate module???
//var tasks = require('lib/tasks')

var task =
module.tast =
function(func){
	func.__task__ = true
	return func }


//
// 	action: ['Path/To/Action',
// 		abortablePromise('abort-id', function(abort, ...args){
//
// 			abort.cleanup(function(reason, res){
// 				if(reason == 'done'){
// 					// ...
// 				}
// 				if(reason == 'aborted'){
// 					// ...
// 				}
// 			})
//
// 			return new Promise(function(resolve, reject){ 
// 				// ... 
//
// 				if(abort.isAborted){
//					// handle abort...
// 				}
//
//				// ...
// 			}) })],
//
//
// NOTE: if the returned promise is not resolved .cleanup(..) will not 
// 		be called even if the appropriate .abort(..) as called...
//
// XXX is the abort api an overkill??
// 		...can this be solved/integrated with tasks???
// 		essentially this creates an abortable task, for full blown tasks
// 		it would be nice to also be able to:
// 			- pause/resume (abort is done)
// 			- serialize/restore
// 			- list/sort/prioritize
// 			- remote (peer/worker)
// XXX docs...
var abortablePromise =
module.abortablePromise = 
function(title, func){
	return Object.assign(
		task(function(...args){
			var that = this

			var abort = object.mixinFlat(
				this.abortable(title, function(){
					that.clearAbortable(title, abort) 
					return abort }), 
				{
					get isAborted(){
						return !((that.__abortable || new Map())
							.get(title) || new Set())
								.has(this) },

					__cleanup: null,
					cleanup: function(func){
						var args = [...arguments]
						var reason = this.isAborted ? 
							'aborted' 
							: 'done'
						typeof(func) == 'function' ?
							// register handler...
							(this.__cleanup = this.__cleanup 
								|| new Set()).add(func)
							// call cleanup handlers...
							: [...(this.__cleanup || [])]
								.forEach(function(f){ 
									f.call(that, reason, ...args) }) 
						return this },
				})

			return func.call(this, abort, ...args) 
				.then(function(res){
					abort.cleanup(res)()
					return res })
				.catch(function(res){
					abort.cleanup(res)() }) }),
		{
			toString: function(){
				return `core.abortablePromise('${ title }', \n${ func.toString() })` },
		}) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var Task =
module.Task =
object.Constructor('Task', {
})


// XXX
var events = require('lib/types/event')


var taskAction =
module.taskAction =
function(title, func){
	var action
	return (action = Object.assign(
		task(function(...args){
			var that = this

			// XXX
			var ticket = events.EventMixin({
				// can be:
				// 	- ready
				// 	- running
				// 	- done
				state: null,

				start: events.Event('start', function(handle, ...args){
					if(this.state == 'ready'){
						that.resumeTask(title, action)
						handle(...args) } }),
				pause: events.Event('pause', function(handle, ...args){
					if(this.state == 'running'){
						that.pauseTask(title, action)
						handle(...args) } }),
				abort: events.Event('abort', function(handle, ...args){
					if(!this.state != 'done'){
						that.abortTask(title, action) 
						handle(...args) } }),
			})

			// XXX

			return func.call(this, ticket, ...args) }),
		{
			toString: function(){
				return `core.taskAction('${ title }', \n${ func.toString() })` },
		})) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var makeTaskAction = 
function(name, from, to, callback){
	return function(title, task='all'){
		title = title == '*' || title == 'all' ?
				[...(this.__running_tasks || new Map()).keys()]
			: title instanceof Array ?
				title
			: [title]
		this.__running_tasks
			&& title
				.forEach(function(title){
					[...(this.__running_tasks || new Map()).get(title) || []]
						.forEach(function(t){ 
							// filter task...
							;(task == 'all' 
									|| task == '*' 
									|| task === t
									|| (task instanceof Array 
										&& task.includes(t)))
								// filter states...
								&& (from == '*' 
									|| from == 'all' 
									|| t.state == from)
								// XXX do we retrigger???
								//&& t.state != to
								// call handler...
								&& t[name] 
								&& t[name]() !== false
								// state...
								&& to 
									&& (t.state = to) }) 
					callback
						&& callback.call(this, title, task) }.bind(this)) 
			// cleanup...
			this.__running_tasks
				&& this.__running_tasks.size == 0
				&& (delete this.__running_tasks) } }



// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var TaskActions = actions.Actions({
	config: {
	},

	// Format:
	// 	Map({
	// 		title: Set([
	// 			{
	// 				state: ...,
	// 				abort: func,
	// 				pause: func,
	// 				resume: func,
	// 				...
	// 			},
	// 			...
	// 		]),
	// 		...
	// 	})
	//
	__running_tasks: null,

	// XXX should this .resume(..)???
	// XXX might be a good idea to make this compatible with tasks.Queue(..)
	// 		...and return a queue if not task is given??
	Task: ['- System/',
		doc`
		`,
		function(title, task){
			// reserved titles...
			if(title == 'all' || title == '*'){
				throw new Error('.abortable(..): can not set reserved title: "'+ title +'".') }

			var tasks = this.__running_tasks = this.__running_tasks || new Map()
			var set = tasks.get(title) || new Set()
			tasks.set(title, set)
			set.add(task)

			task.state = 'running'

			return task }],

	getTasks: ['- System/',
		function(title='all', state='all'){
			var normArg = function(arg){
				return !arg ?
						'all'
					: arg == 'all' || arg == '*' ? 
						arg 
					: arg instanceof Array ?
						new Set(arg)	
					: new Set([arg]) }

			title = normArg(title)
			state = normArg(state)

			return this.__running_tasks ?
				[...this.__running_tasks.entries()]
					.reduce(function(res, [t, set]){
						if(title != 'all' 
								&& title != '*' 
								&& !title.has(t)){
							return res }
						var l = [...set]
							.filter(function(t){ 
								return state == 'all' 
									|| state == '*' 
									|| state.has(t.state) })
						l.length > 0
							&& (res[t] = l)
						return res }, {})
					: {} }],
	// XXX should this abort the cleared tasks???
	// 		...if not would be logical to rename this to ._clearTask(..)
	clearTask: ['- System/',
		function(title, task='all'){
			// clear all...
			if(title == '*' || title == 'all'){
				delete this.__running_tasks }

			var set = ((this.__running_tasks || new Map()).get(title) || new Set())
			// clear specific handler...
			task != '*' 
				&& task != 'all'
				&& set.delete(task)
			// cleanup / clear title...
			;(set.size == 0 
					|| task == '*' 
					|| task == 'all')
				&& (this.__running_tasks || new Set()).delete(title) 
			// cleanup...
			this.__running_tasks
				&& this.__running_tasks.size == 0
				&& (delete this.__running_tasks) }],

	// XXX cache???
	get tasks(){
		return this.actions.filter(function(action){
			return !!this.getActionAttr(action, '__task__') }.bind(this)) },

	get tasksActive(){
		return this.getTasks() },
	get tasksRunning(){
		return this.getTasks('all', 'running') },
	get tasksPaused(){
		return this.getTasks('all', 'paused') },

	pauseTask: ['- System/',
		makeTaskAction('pause', 'running', 'paused')],
	resumeTask: ['- System/',
		makeTaskAction('resume', 'paused', 'running')],
	abortTask: ['- System/',
		makeTaskAction('abort', 'all', null,
			function(title, task='all'){
				this.__running_tasks
					&& (task == 'all' 
						|| task == '*' 
						|| this.__running_tasks.get(title).size == 0)
					&& this.__running_tasks.delete(title) })],


	// XXX LEGACY -- remove after migrating sharp.js and abortablePromise(..)
	//
	// Abortable...
	//
	// Format:
	// 	Map({
	// 		title: Set([ func, ... ]),
	// 		...
	// 	})
	//
	// XXX rename...
	// XXX extend to support other task operations...
	__abortable: null,

	abortable: ['- System/Register abort handler',
		doc`Register abortable action

			.abortable(title, func)
				-> func

		`,
		function(title, callback){
			// reserved titles...
			if(title == 'all' || title == '*'){
				throw new Error('.abortable(..): can not set reserved title: "'+ title +'".') }

			var abortable = this.__abortable = this.__abortable || new Map()
			var set = abortable.get(title) || new Set()
			abortable.set(title, set)
			set.add(callback) 

			return actions.ASIS(callback) }],
	clearAbortable: ['- System/Clear abort handler(s)',
		doc`Clear abort handler(s)

			Clear abort handler...
			.clearAbortable(title, callback)

			Clear all abort handlers for title...
			.clearAbortable(title)
			.clearAbortable(title, 'all')

			Clear all abort handlers...
			.clearAbortable('all')

		`,
		function(title, callback){
			callback = callback || '*'

			// clear all...
			if(title == '*' || title == 'all'){
				delete this.__abortable }

			var set = ((this.__abortable || new Map()).get(title) || new Set())
			// clear specific handler...
			callback != '*' 
				&& callback != 'all'
				&& set.delete(callback)
			// cleanup / clear title...
			;(set.size == 0 
					|| callback == '*' 
					|| callback == 'all')
				&& (this.__abortable || new Set()).delete(title) 
			// cleanup...
			this.__abortable
				&& this.__abortable.size == 0
				&& (delete this.__abortable) }],
	abort: ['- System/Abort task(s)',
		doc`

			.abort(title)
			.abort([title, .. ])

			.abort('all')

		`,
		function(title, task='all'){
			title = title == '*' || title == 'all' ?
					[...(this.__abortable || new Map()).keys()]
				: title instanceof Array ?
					title
				: [title]

			this.__abortable
				&& title
					.forEach(function(title){
						[...(this.__abortable || new Map()).get(title) || []]
							.forEach(function(f){ f() })
						this.__abortable
							&& this.__abortable.delete(title) }.bind(this))
			// cleanup...
			this.__abortable
				&& this.__abortable.size == 0
				&& (delete this.__abortable) }],


	/* XXX LEGACY...
	get jobs(){
		return this.__jobs },

	getJob: ['- Jobs/',
		function(name){
			name = name || this.data.newGID()

			// get/init task dict...
			var t = this.__jobs = this.__jobs || {}
			// get/init task...
			var job = t[name] = t[name] || tasks.Queue()
			job.name = name

			return job
		}],
	//*/
})


var Tasks = 
module.Tasks = ImageGridFeatures.Feature({
	title: '',

	tag: 'tasks',

	depends: [ ],

	actions: TaskActions,

	handlers: [
	],
})



//---------------------------------------------------------------------
// Self test framework...

// Indicate an action to be a self-test action...
// 
// Self test actions are run by .selfTest(..)
// 
// XXX should we set an action attr or a func attr here???
var selfTest =
module.selfTest = function(func){
	func.__self_test__ = true
	return func
}

var SelfTestActions = actions.Actions({
	config: {
		'run-selftest-on-start': true,
	},

	selfTest: ['System/Run self test',
		selfTest(function(mode){
			var that = this
			var logger = this.logger && this.logger.push('Self test')

			var tests = this.actions
				.filter(function(action){ 
					return action != 'selfTest'
			   			&& (that[action].func.__self_test__ 
							|| that.getActionAttr(action, 'self_test'))})

			logger 
				&& tests.forEach(function(action){ 
					logger.emit('found', action) })


			tests.forEach(function(action){
				that[action]()

				logger 
					&& logger.emit('done', action)
			})
		})],
})

var SelfTest = 
module.SelfTest = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'self-test',
	depends: [
		'lifecycle'	
	],
	suggested: [
		'logger',
	],
	priority: 'low',

	actions: SelfTestActions, 

	handlers: [
		['start',
			function(){ 
				this.config['run-selftest-on-start'] 
					&& this.selfTest() }]
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
