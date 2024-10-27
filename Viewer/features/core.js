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
* 	- util
* 	- introspection
* 	- logger
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
* 	- journal
* 		action journaling and undo/redo functionality
* 		XXX needs revision...
* 	- changes
* 		change tracking
* 	- workspace
* 		XXX needs revision...
* 	- tasks
* 		tasks -- manage long running actions
* 		queue -- manage lots of small actions as a single task
* 		contexts -- XXX
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

var types = require('lib/types')
var runner = require('lib/types/runner')
var util = require('lib/util')
var object = require('lib/object')
var actions = require('lib/actions')
var features = require('lib/features')
var toggler = require('lib/toggler')


// code/text normalization...
var doc = module.doc = actions.doc
var text = module.text = object.text



/*********************************************************************/
// Root ImageGrid.viewer object constructor...
//
// This adds:
// 	- toggler as action compatibility
//
var ImageGridMetaActions =
module.ImageGridMetaActions = {
	__proto__: actions.MetaActions,

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
			} } }),
} 

var ImageGrid = 
module.ImageGrid = 
	object.Constructor('ImageGrid', ImageGridMetaActions)


// Root ImageGrid feature set....
var ImageGridFeatures =
module.ImageGridFeatures = 
	new features.FeatureSet()

// setup base instance constructor...
ImageGridFeatures.__actions__ = 
	function(){ 
		return actions.Actions(ImageGrid()) }



//---------------------------------------------------------------------
// Setup runtime info...
//
// XXX add PWA / chrome-app...
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
	if(process.versions['electron'] != null 
			// node mode...
			&& typeof(document) != 'undefined'){
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
	} }

// browser...
// NOTE: we're avoiding detecting browser specifics for as long as possible,
// 		this will minimize the headaches of supporting several non-standard
// 		versions of code...
if(typeof(window) != 'undefined'){
	runtime.browser = true }



/*********************************************************************/
// Util...

// Toggle value in .config...
//
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
				this.config[a[0]] = this.config[a[0]] } },
		states, pre, post) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 
var UtilActions = actions.Actions({
	mergeConfig: ['- System/', 
		doc`Merge a config object into .config
		`,
		function(config){
			config = config instanceof Function ? config.call(this)
				: typeof(config) == typeof('str') ? this.config[config]
				: config
			Object.assign(this.config, config) }],
})

var Util = 
module.Util = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'util',

	actions: UtilActions,
})



//---------------------------------------------------------------------
// Introspection...

// Indicate that an action is not intended for direct use...
//
// NOTE: this will not do anything but mark the action.
var notUserCallable =
module.notUserCallable = 
function(func){
	func.__not_user_callable__ = true
	return func }

// NOTE: this is the same as event but user-callable...
var UserEvent =
module.UserEvent = 
function(func){
	func.__event__ = true
	return func }

// XXX rename???
var Event =
module.Event = 
function(func){
	func.__event__ = true
	return notUserCallable(func) }


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
					break }
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
// Logger...

var LoggerActions = actions.Actions({
	config: {
		// NOTE: if set to 0 no log limit is applied...
		'log-size': 10000,
	},

	Logger: object.Constructor('BaseLogger', {
		doc: `Logger object constructor...`,

		root: null,
		parent: null,

		// Quiet mode...
		//
		// NOTE: if local mode is not defined this will get the mode of 
		// 		the nearest parent...
		// XXX need these to be persistent...
		// XXX add support for log levels...
		__quiet: null,
		get quiet(){
			var cur = this
			while(cur.__quiet == null && cur.parent){
				cur = cur.parent }
			return !!cur.__quiet },
		set quiet(value){
			value == null ?
				(delete this.__quiet)
				: (this.__quiet = !!value) },

		__context: null,
		get context(){
			return this.__context || this.root.__context },

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
			// settings...
			var attrs = typeof(msg.last()) != typeof('str') ?
				msg.pop()
				: {}
			return msg.length == 0 ?
				this
				: Object.assign(
					this.constructor(),
					attrs,
					{
						root: this.root,
						parent: this,
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
	set logger(value){
		this.__logger = value },

	// XXX move this to console-logger???
	// XXX should this be an action???
	handleLogItem: ['- System/',
		function(logger, path, status, ...rest){
			logger.quiet 
				|| logger.root.quiet
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
// System life-cycle...

// XXX potential pitfall: setting up new features without restarting...
// 		this can happen for instance in ig.js when starting a minimal
// 		imagegrid instance and then adding new features -- these new 
// 		features will not get their .start() (and friends) run...
// 		There are three stages here:
// 			- feature setup
// 				things the feature needs to run -- <feature>.setup(..)
// 			- app start
// 				things the app wants to do on start
// 			- ???
// 				things feature action needs to run in cli should be 
// 				documented and not depend on .start(..)
// 				...or there should be a way to "start" the new features...
// 		XXX put this in the docs...
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
			this.logger 
				&& this.logger.push('System').emit('start')

			// NOTE: jQuery currently provides no way to check if an event
			// 		is bound so we'll need to keep track manually...
			if(this.__stop_handler == null){
				var stop = this.__stop_handler = function(){ that.stop() }

			} else {
				return }

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
					} }
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
				console.warn('Unknown runtime:', runtime) }

			// handle ready event...
			// ...if no one requested to do it.
			if(this.__ready_announce_requested == null
					|| this.__ready_announce_requested <= 0){
				// in the browser world trigger .declareReady(..) on load event...
				if(runtime.browser){
					$(function(){ that.declareReady('start') })

				} else {
					this.declareReady('start') } }

			// ready timeout -> force ready...
			this.config['declare-ready-timeout'] > 0
				&& !this.__ready_announce_timeout
				&& (this.__ready_announce_timeout = 
					setTimeout(
						function(){
							// cleanup...
							delete this.__ready_announce_timeout
							if((this.__ready_announce_requests || new Set()).size == 0){
								delete this.__ready_announce_requests }
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
								delete this.__ready_announce_requests } }.bind(this), 
						this.config['declare-ready-timeout']))

			// trigger the started event...
			this.started() }],
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
			this.logger 
				&& this.logger.push('System').emit('ready') })],
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
				delete this.__ready_announce_requested } }],
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

			return (this.__ready_announce_requested = 
				(this.__ready_announce_requested || 0) + 1) }],

	// XXX revise args...
	// XXX should this be here???
	// XXX EXPERIMENTAL...
	save: ['- System/',
		doc``,
		function(comment){
			// XXX should this trigger the saved event pre/post outer action...
		}],
	saved: ['- System/',
		doc``,
		Event(function(comment){
			// Base save event...
			//
			// Not intended for direct use.
		})],

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
			this.__stop_handler 
				&& this.runtime.browser
				&& $(window).off('beforeunload', this.__stop_handler)

			// nw...
			if(this.__nw_stop_handler && this.runtime.nw){
				nw.Window.get().removeAllListeners('close')
				delete this.__nw_stop_handler }

			// node...
			this.__stop_handler 
				&& this.runtime.node
				&& process.removeAllListeners('exit')

			delete this.__ready
			delete this.__stop_handler

			this.logger 
				&& this.logger.push('System').emit('stop')

			// trigger the stopped event...
			this.stopped() }],
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
					&& func.call(this) } }],

	// helpers...
	//
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
		function(full){ 
			return actions.MetaActions.clone.call(this, full) }],
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
	
// XXX revise: cache group naming...
// 		currently the used groups are:
// 			Session groups -- cleared on .clear() ('cache')
// 				session-*
// 				view-*
// 			View groups -- cleared by crop/collection ('crop', 'collections')
// 				view-*
// 			Changes groups -- cleared when specific changes are made ('changes')
// 				*-data
// 				*-images
// 				...
// 		This approach seems not flexible enough...
// 		Ideas:
// 			- use keywords in group names??
// XXX should we consider persistent caches -- localStorage???
// XXX would be nice to have a simple cachedAction(name, cache-tag, expire, func) 
// 		action wrapper that would not require anything from the action and 
// 		just not call it if already called...
// 		...to do this we'll need to be able to select a value by args 
// 		from the cache this will require a diff mattch or something 
// 		similar...
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


		// Groups to be cleared at the longest on session change...
		//
		// These include by default:
		// 	'session'			- will live through the whole session.
		// 	'view'				- cleared when view changes
		//
		'cache-session-groups': [
			'session',
			'view',
		],

		// XXX handler cache..
	},

	__cache: null,
	cache: doc('Get or set cache value',
		doc`Get or set cache value

			Get cached value in global group...
			.cache(title)
			.cache('global', title)
				-> value
				-> undefined

			Get cached value in a specific group...
			.cache(group, title)
				-> value
				-> undefined
		

			Get/set cached value in the global group...
			.cache(title, handler)
			.cache('global', title, handler)
				-> value
		
			Get/set cached value in a specific group...
			.cache(group, title, handler)
				-> value


			handler(value)
				-> value
		

		Handler calls will overwrite the cached value with the handler 
		returned value on every call, this is different to pure getters 
		that will only fetch a value if it exists.


		Currently the used groups are:
			Global group -- default group
				global
			Session groups -- cleared on .clear() (feature: 'cache')
				session-*
				view-*
			View groups -- cleared by crop/collection (feature: 'crop', 'collections')
				view-*
			Changes groups -- cleared when specific changes are made (feature: 'changes')
				*-data
				*-images
				...
		

		Example use:
			someAction: [
				function(){
					return this.cache('someAction', 
						function(data){
							if(data){
								// clone/update the data...
								// NOTE: this should be faster than the construction
								//		branch below or this will defeat the purpose 
								//		of caching...
								...
		
							} else {
								// get the data...
								...
							}
							return data
						}) }],
		
		
		NOTE: since this is here to help speed things up, introducing a 
			small but not necessary overhead by making this an action is
			not logical...
		`,
		function(title, handler){
			var args = [...arguments]
			var handler = args.pop()
			var group = 'global'
			args.length == 2
				&& ([group, title] = args)

			// caching disabled...
			if(!(this.config || {}).cache){
				return typeof(handler) != 'function' ?
					undefined
					: handler.call(this) }
			// get...
			if(typeof(handler) != 'function'){
				return ((this.__cache || {})[group] || {})[handler]
			// handle...
			} else {
				var cache = this.__cache = this.__cache || {}
				cache = cache[group] = cache[group] || {}
				return (cache[title] = 
					title in cache ? 
						// pass the cached data for cloning/update to the handler...
						handler.call(this, cache[title])
						: handler.call(this)) } }),
	clearCache: ['System/Clear cache',
		doc`

			Clear cache fully...
			.clearCache()
			
			Clear title (global group)...
			.clearCache(title)

			Clear title from group...
			.clearCache(group, title)

			Clear out the full group...
			.clearCache(group, '*')


		NOTE: a group can be a string, list or a regexp object.
		`,
		function(title){
			var that = this
			// full clear...
			if(arguments.length == 0 
					|| (arguments[0] == '*' 
						&& arguments[1] == '*')){
				delete this.__cache
			// partial clear...
			} else {
				var group = 'global'
				// both group and title given...
				arguments.length > 1
					&& ([group, title] = arguments)

				// regexp...
				// NOTE: these are only supported in groups...
				if(group != '*' && group.includes('*')){
					group = new RegExp('^'+ group +'$', 'i')
					group = Object.keys(this.__cache || {})
						.filter(function(g){
							return group.test(g) }) }

				// clear title from each group...
				if(group == '*' || group instanceof Array || group instanceof RegExp){
					;(group instanceof Array ?
						group
					: group instanceof RegExp ? 
						Object.keys(this.__cache || {})
							.filter(function(g){
								return group.test(g) })
					: Object.keys(this.__cache || {}))
						.forEach(function(group){
							that.clearCache(group, title) })
				// clear multiple titles...
				} else if(title instanceof Array){
					title.forEach(function(title){
						delete ((that.__cache || {})[group] || {})[title] })
				// clear group...
				} else if(title == '*'){
					delete (this.__cache || {})[group]
				// clear title from group...
				} else {
					delete ((this.__cache || {})[group] || {})[title] } } }],

	// special caches...
	//
	sessionCache: ['- System/',
		doc`Add to session cache...

			.sessionCache(title, handler)
				-> value


		This is a shorthand to:

			.cache('session', title, handler)
				-> value


		NOTE: also see .cache(..)
		`,
		'cache: "session" ...'],


	// XXX doc: what are we precaching???
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
					attrs.push(k) }
				var l = attrs.length

				var started = Date.now()
				var show = this.config['pre-cache-progress']

				var tick = function(){
					var a = Date.now()
					var b = a
					if(attrs.length == 0){
						return }
					while(b - a < c){
						this[attrs.pop()]
						b = Date.now()
						done += 1
						this.showProgress
							&& (show === true || (show && b - started > show))
							&& this.showProgress('Caching', done, l) }
					t === true ?
						tick()
						: setTimeout(tick, t) }.bind(this)

				tick() } }],
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
		// System...
		['start.pre', 
			function(){ 
				this.clearCache()
				var t = this.config['pre-cache']
				t === true ?
					this.preCache('now') 
				: t >= 0 ?
					this.preCache() 
				: false }],
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


		// clear session cache...
		['clear',
			//'clearCache: "(session|view)(-.*)?" "*" -- Clear session cache'],
			function(){
				this.clearCache(`(${ 
					(this.config['cache-session-groups'] 
							|| ['session', 'view'])
						.join('|') })(-.*)?`) }],
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
//
// 		postcall: true,
// 	}
//
// XXX might be a good ide to move this someplace generic...
// XXX this is not debouncing pre/post calls, just the base action...
var debounce =
module.debounce =
function(options, func){
	// parse args...
	var args = [...arguments]
	func = args.pop()
	options = args.pop() || {} 

	typeof(options) == typeof(123)
		&& (options.timeout = options)

	// closure state...
	var res
	var last_args
	var debounced = false
	var retriggered = 0

	// call the action...
	var call = function(context, ...args){
		return func instanceof Function ?
			func.call(context, ...args)
			// alias...
			: this.parseStringAction.callAction(context, func, ...args) }

	return object.mixin(
		function(...args){
			var retrigger
			// call...
			if(!debounced){
				res = call(this, ...args)
				res = options.returns != 'cahced' ? 
					res 
					: undefined

				// start the timer...
				debounced = setTimeout(
					function(){
						var c
						// callback...
						options.callback instanceof Function
							&& (c = options.callback.call(this, retriggered, args))
						// retrigger...
						options.postcall
							&& retriggered > 0
							&& c !== false
							// XXX should this be a debounced call or a normal call...
							// XXX this is not the actual action thus no 
							// 		handlers will be triggered...
							&& call(this, ...last_args)
						// cleanup...
						retriggered = 0
						res = undefined
						debounced = false }.bind(this), 
					options.timeout 
						|| this.config['debounce-action-timeout'] 
						|| 200)
			// skip...
			} else {
				retriggered++
				last_args = args
				return res } },
		{
			toString: function(){
				return `// debounced...\n${
					doc([ func instanceof Function ? 
						func.toString() 
						: func ])}` },
		}) }



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
						: this.call(func) }.bind(this),
				ms || 0) }],
	clearTimeout: ['- System/',
		function(id){
			var timeouts = 
				this.__timeouts = 
					this.__timeouts 
					|| {}
			clearTimeout(timeouts[id])
			delete timeouts[id]	}],

	setInterval: ['- System/',
		function(id, func, ms){
			var intervals = this.__intervals = this.__intervals || {}

			id in  intervals
				&& clearInterval(intervals[id])

			intervals[id] = setInterval(
				(func instanceof Function ? func : function(){ this.call(func) })
					.bind(this),
				ms || 0) }],
	clearInterval: ['- System/',
		function(id){
			var intervals = this.__intervals = this.__intervals || {}
			clearInterval(intervals[id])
			delete intervals[id] }],

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
				return }
			if(typeof(action) != typeof('str')){
				console.error('Persistent interval: handler must be a string.')
				return }

			id in  intervals
				&& clearInterval(intervals[id])

			this.config['persistent-intervals'] = cfg
			cfg[id] = {
				action: action, 
				ms: ms,
			}

			intervals[id] = setInterval(
				function(){ 
					this.call(action) }.bind(this), 
				ms || 0) }],
	clearPersistentInterval: ['- System/',
		function(id, stop_only){
			var intervals = 
				this.__persistent_intervals = 
					this.__persistent_intervals || {}
			clearInterval(intervals[id])
			delete intervals[id]	
			if(!stop_only){
				delete this.config['persistent-intervals'][id] } }],
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
			: console.error('persistentIntervals: unknown action:', action) }],

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
					: args.shift() }

			// sanity check: when debouncing a function a tag is required...
			if(tag instanceof Function){
				throw new TypeError(
					'debounce: when passing a function a tag is required.') }

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
						func.call(this, ...args) } },
			})

			var func = this[attr] = this[attr] || debounce(options, action)

			return func.call(this, ...args) }],
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

				this.persistentIntervals('stop') }],

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
					.setInterval('everyHour', 'everyHour', m*60) }],
	],
})



//---------------------------------------------------------------------
// Journal...
//
// This feature logs actions that either have the journal attribute set 
// to true or have an undo method/alias...
// 
// Example:
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
// 			{undo: 'otherAction'
//
// 				// test if action can be undone (returns bool)...
// 				// NOTE: this is called before the <action>...
// 				// NOTE: this can be an alias...
// 				undoable: function(data){
// 					...
// 				},
//
// 				// if true do not group nested action calls (default: store)
// 				// this can be:
// 				//	'store'		- store nested journal in .nested
// 				//	'drop'		- drop nested actions from journal
// 				//	'keep'		- keep nested actions in journal
// 				// XXX currently store/drop modes may include deferred or
// 				//		triggered by external events actions...
// 				nestedUndo: 'store',
//
// 				// store aditional undo state in the data, to be used by <action>.undo(..)...
// 				// NOTE: this is called after the <action>...
// 				// NOTE: this can be an alias...
// 				getUndoState: function(data){
// 					...
// 				}},
// 			function(){ 
// 				... 
// 			}],
//
// NOTE: .undo has priority over .journal, so there is no point of 
// 		defining both .journal and .undo action attributes, one is 
// 		enough.
//
//

// XXX need a mechanism to store the journal in sync (localStorage/fs)
// 		and be able to execute the journal from a save position (which one?) 
// 		if recovering from close/crash...
// 		XXX should this be a separate feature???
//
// XXX would be great to add a mechanism define how to reverse actions...
// 		...one way to do this at this point is to revert to last state
// 		and re-run the journal until the desired event...
// XXX need to define a clear journaling strategy in the lines of:
// 		- save state clears journal and adds a state load action
// 		- .load(..) clears journal
// XXX needs careful testing...
// XXX add a ui...
var JournalActions = actions.Actions({

	clone: [function(full){
		return function(res){
			res.rjournal = null
			res.journal = null
			if(full && this.hasOwnProperty('journal') && this.journal){
				res.journal = JSON.parse(JSON.stringify(this.journal)) } } }],

	// for format docs see: .updateJournalableActions(..)
	journal: null,
	rjournal: null,

	// XXX revise... 
	get journalUnsaved(){
		var res = []
		//for(var e of (this.journal || []).slice().reverse()){
		for(var i=(this.journal || []).length-1; i >= 0; i--){
			var e = this.journal[i]
			// everything until a load or a save event...
			if(e == 'SAVED' 
					|| e.type == 'save'
					|| e.action == 'load'){
				break }
			res.unshift(e) }
		return res },

	get journalable(){
		return this.cache('journalable-actions', function(data){
			return data ?
				data.slice()
				: this.updateJournalableActions() }) },

	// XXX RACE?: can things get on the journal while an action is running???
	// 		...this would make the way nested actions are collected wrong 
	// 		...this could happen for long and deferred actions...
	// 		...not sure how handlers outside the action can be handled here 
	// 		...investigate pushing undo to either top (explicitly user-called 
	// 		action) or the bottom (actual data manipulation) levels...
	// 		...let the client action configure things???
	// 		...can we automate this -- marking nested actions???
	// 		...a way to indirectly go around this is to investigate/document
	// 		the possibilities and conditions of undo usage providing 
	// 		appropriate API for all cases...
	// XXX <action>.getUndoState(..) should be called for every action 
	// 		in chain???
	// XXX should aliases support explicit undo??? (test)
	updateJournalableActions: ['- System/',
		doc`Update journalable actions

		This will setup the action journal handler as a .pre handler 
		(tagged: 'journal-handler').

		NOTE: calling this again will reset the existing handlers and add 
			new ones.
		NOTE: the list of journalable actions is cached and accessible via
			.journalable prop and the cache API, e.g. via .cache('journalable-actions').
		NOTE: action aliases can not handle undo.

		.journal / .rjournal format:
			[
				// journaled action..
				{
					type: 'basic' | ...,
					date: <timestamp>,
		
					action: <action-name>,
					args: [ ...	],
		
					// the current image before the action...
					current: undefined | <gid>
		
					// the target (current) image after action...
					target: undefined | <gid>

					// action state, only set on undoable actions when undone.
					undone: true | false,

					// nested action journal (optional)
					// this contains actions called from within the current
					// action that can be undone.
					nested: [ ... ],
		
					// additional data, can be set via: 
					//		<action>.getUndoState(<data>)...
					...
				},

				...
			]

		NOTE: newer journal items are pushed to the .journal tail...
		`,
		function(){
			var that = this
			var handler = function(action){
				return function(){
					var len = (this.journal || []).length
					var data = {
						type: 'basic',
						date: Date.now(),

						action: action, 
						args: [...arguments],

						current: this.current, 
						// NOTE: we set this after the action is done...
						target: undefined, 
					}

					// test if we need to journal this action signature...
					var test = that.getActionAttrAliased(action, 'undoable')
					if(test === false 
							|| (test && !test.call(that, data))){
						return }

					// journal after the action is done...
					return function(){ 
						data.target = this.current
						// collect nested journal data...
						var nestedUndo = 
							this.getActionAttr(action, 'nestedUndo') 
							|| 'store'
						if(nestedUndo != 'keep'
								&& (this.journal || []).length > len){
							var nested = (this.journal || []).splice(len) 
							nestedUndo == 'store'
								&& (data.nested = nested) }
						// prep to get additional undo state...
						// XXX this should be called for all actions in chain...
						var update = that.getActionAttrAliased(action, 'getUndoState')
						update 
							&& update instanceof Function
							&& update.call(that, data)
						this.journalPush(data) } } }

			return this
				// NOTE: we will overwrite the cache on every call...
				.cache('journalable-actions', function(){ 
					return this.actions
						.filter(function(action){
							// remove all existing journal handlers before we setup again...
							that.off(action+'.pre', 'journal-handler')
							// skip aliases...
							return !(that[action] instanceof actions.Alias)
								&& (!!that.getActionAttr(action, 'undo') 
									|| !!that.getActionAttr(action, 'journal')) })
						// set the handler
						.map(function(action){
							that.on(action+'.pre', 'journal-handler', handler(action))
							return action }) }) }],

	// XXX unify names (globally) -> .journal<Action>(..) or .<action>Journal(..)
	journalPush: ['- System/Journal/Add an item to journal',
		function(data){
			// clear the reverse journal...
			// XXX we do not want to do this on redo...
			this.rjournal
				&& (this.rjournal = null)

			this.journal = 
				(this.hasOwnProperty('journal') || this.journal) ? 
					this.journal || []
					: []
			this.journal.push(data) }],
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
				&& (this.rjournal = null) }],
	// XXX not sure about the filter arg...
	runJournal: ['- System/Journal/Run journal',
		//{journal: true},
		function(journal, filter){
			var that = this
			journal.forEach(function(e){
				;(typeof(filter) == 'function'?
						filter.call(that, e)
						: true)
					&& that
						.focusImage(e.current)
						// run action...
						[e.action].apply(that, e.args) }) }],

	// XXX needs very careful revision...
	// 		- should this be thread safe??? (likely not)
	// 		- revise actions...
	// XXX should we stop at non-undoable actions???
	// 		...intuitively, yes, as undoing past these may result in an 
	// 		inconsistent state...
	// XXX should we implement redo as an undo of undo?
	// XXX use .journalUnsaved???
	undo: ['Edit/Undo',
		doc`Undo last action(s) from .journal that can be undone

			.undo()
			.undo(<count>)
			.undo('<time-period>')
			.undo('unsaved')
			.undo('all')


		This will shift the action from .journal to .rjournal preparing 
		it for .redo()

		NOTE: this counts undoable actions only.
		NOTE: actions when undone (i.e. undoable) are marked with .undone = true
			while unundoable actions are simply copied over to .rjournal
		`,
		{mode: function(){ 
			return (this.journal && this.journal.length > 0) || 'disabled' }},
		function(count=1){
			count = count == 'all' ?
				Infinity
				: count
			var to = 
				// time period...
				(typeof(count) == 'string' 
						&& Date.isPeriod(count)) ?
					Date.now() - Date.str2ms(count)
				// Date...
				: count instanceof Date ?
					count.valueOf()
				: false
			// NOTE: these are isolated from any other contexts and will 
			// 		be saved as own attributes...
			var journal = (this.journal || []).slice() || []
			var rjournal = (this.rjournal || []).slice() || [] 

			for(var i = journal.length-1; i >= 0; i--){
				var a = journal[i]

				// stop at save point...
				if(count == 'unsaved'
						&& (a == 'SAVED' 
							|| a.type == 'save')){
					break }
				// stop at date...
				if(to && a.date*1 < to){
					break }
				// stop at load...
				// XXX not sure if this is correct....
				if(a.action == 'load'){
					break }
				// stop at explicitly undoable actions...
				var undoable = this.getActionAttrAliased(a.action, 'undoable')
				if(undoable === false 
						|| (undoable
							&& !undoable.call(this, a))){
					break }

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
					// XXX should we cache this???
					undo instanceof Function ?
						// pass the action name...
						undo.call(this, a)
					: typeof(undo) == typeof('str') ? 
						// XXX pass journal structure as-is... (???)
						this[undo].apply(this, a.args)
					: null 

					a.undone = true } 

				// push the action to the reverse journal...
				rjournal.push(journal.pop()) 
			
				// stop when done...
				if(undo 
						&& typeof(count) == 'number'
						&& --count <= 0){
					break } } 

			// restore journal state...
			// NOTE: calling the undo action would have cleared
			// 		the rjournal and added stuff to the journal
			// 		so we will need to restore things...
			this.journal = journal
			this.rjournal = rjournal }],
	// NOTE: we do not have to care about .nested actions on the redo
	// 		level as they will be nested again by the root action...
	redo: ['Edit/Redo',
		doc`Redo an action from .rjournal

			.redo()
			.redo(<count>)
			.redo('all')

		Essentially this will remove and re-run the last action in .rjournal

		NOTE: this will clear the .undone attr of redoable actions
		`,
		{mode: function(){ 
			return (this.rjournal && this.rjournal.length > 0) || 'disabled' }},
		function(count=1){
			if(!this.rjournal || this.rjournal.length == 0){
				return }

			var journal = this.journal
			var rjournal = this.rjournal
			var l = rjournal.length

			if(count == 'all'){
				count = Infinity
			} else {
				var t = 0
				var c = 0
				// count only undoable actions, i.e. the ones we undid...
				for(var a of rjournal.slice().reverse()){
					c++
					a.undone	
						&& t++
					if(t >= count){
						break } }
				count = c }

			this.runJournal(
				rjournal.splice(l-count || 0, count),
				// skip actions not undoable and push them back to the journal...
				function(e){
					var redo = e.undone
					!redo
						&& journal.push(e)
					delete e.undone
					return redo })

			// restore .rjournal after actions are run...
			// NOTE: this is done to compensate for .journalPush(..) clearing
			// 		the .rjournal in normal operation...
			// XXX HACK???
			this.rjournal = rjournal }],

	//undoUnsaved: ['Edit/Undo unsaved',
	//	'undo: "unsaved"'],
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
			'updateJournalableActions'],

		// clear journal when clearing...
		// XXX we should be loading new journal instead...
		// XXX is this a good idea???
		['load clear',
			'clearJournal'],

		// log saved event to journal...
		['saved',
			function(res, ...args){
				// XXX
				//this.journal.push('SAVED')
				this.journalPush({
					type: 'save',
					// XXX should use the actual save timestamp...
					date: Date.now(),
					current: this.current, 
					target: this.current, 
				}) }],
	],
})


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX persistent journal...
// 		- on journal -- save journal to localStorage
// 		- on clear/load/timer -- save journal to file (auto-save)
// 			...fs???
// 		- on load -> load journal after last save
// XXX need to revise journaling actions before shipping this...
// XXX EXPERIMENTAL...
var PersistentJournalActions = actions.Actions({
	// XXX undoUnsaved(..) / reloadSaved(..)
})

var PersistentJournal = 
module.PersistentJournal = ImageGridFeatures.Feature({
	title: 'Action persistent Journal',

	tag: 'journal-persistent',
	depends: [
		'journal',
	],

	actions: PersistentJournalActions,

	handlers: [
		// XXX
	],
})



//---------------------------------------------------------------------
// Changes... 

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
			if(full 
					&& this.hasOwnProperty('changes') 
					&& this.changes){
				res.changes = JSON.parse(JSON.stringify(this.changes)) } } }],

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
					return }
				changes[section] = (changes[section] || [])
					.concat(items)
					.unique()
				this.changes = changes

			// section(s)...
			} else {
				args.forEach(function(arg){
					changes[arg] = true })
				this.changes = changes } }],
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
					res.changes = JSON.parse(JSON.stringify(this.changes)) } }],
		['load',
			function(_, data){
				if(data.changes){
					this.changes = JSON.parse(JSON.stringify(data.changes)) } }],

		// clear caches relating to stuff we just changed...
		['markChanged',
			function(_, section){
				section = (section instanceof Array ?
						section
						: [section])
					.map(function(section){ 
						return '.*-'+section })
				this.clearCache(section, '*') }],
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

		var data = keys instanceof Function ? 
			keys.call(this) 
			: keys

		// store data...
		data.forEach(function(key){
			workspace[key] = JSON.parse(JSON.stringify(that.config[key])) })

		callback && callback.call(this, workspace) } }

// XXX should this delete a prop if it's not in the loading workspace???
// XXX only replace a prop if it has changed???
// XXX handle defaults -- when a workspace was just created...
var makeWorkspaceConfigLoader =
module.makeWorkspaceConfigLoader = function(keys, callback){
	return function(workspace){
		var that = this

		var data = keys instanceof Function ? 
			keys.call(this) 
			: keys

		// load data...
		data.forEach(function(key){
			// the key exists...
			if(key in workspace){
				that.config[key] = JSON.parse(JSON.stringify(workspace[key]))

			// no key set...
			// XXX is this the right way to go???
			} else {
				delete that.config[key] } })

		callback 
			&& callback.call(this, workspace) } }


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
				this.config['workspaces'] = 
					JSON.parse(JSON.stringify(this.config['workspaces'])) }

			var res = {}

			if(name !== null){
				this.config['workspaces'][name || this.config.workspace] = res }

			return res }],
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
				return name } }],

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
				return }

			this.workspace != name && this.loadWorkspace(name)
			stack.push(name) }],
	popWorkspace: ['- Workspace/',
		function(){
			var stack = this.__workspace_stack

			if(!stack || stack.length == 0){
				return }

			this.saveWorkspace()
			this.loadWorkspace(stack.pop()) }],
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
// Tasks and Queues...

// Task wrapper...
//
// This simply makes tasks actions discoverable...
var Task =
module.Task =
function(func){
	func.__task__ = true
	return func }


// Task action helpers...
//
// NOTE: for examples see:
// 		features/examples.js: 
// 			ExampleActions.exampleTask(..)
// 			ExampleActions.exampleSessionTask(..)
// NOTE: we can pass sync/async to this in two places, in definition:
// 			var action = taskAction('some title', 'sync', function(..){ .. })
// 		or
// 			var action = taskAction('sync', 'some title', function(..){ .. })
// 		and on call:
// 			action('sync', ..)
// 		during the later form 'sync' is passed to .Task(..) in the correct
// 		position...
// 		(see ig-types' runner.TaskManager(..) for more info)
var taskAction =
module.taskAction =
function(title, func){
	var pre_args = [...arguments]
	func = pre_args.pop()
	title = pre_args
		.filter(function(t){ 
			return t != 'sync' && t != 'async' })
		.pop()

	var action
	return (object.mixin(
		action = Task(function(...args){
			if(args[0] == 'sync' || args[0] == 'async'){
				pre_args = [args.shift(), title] }
			return Object.assign(
				this.tasks.Task(...pre_args, func.bind(this), ...args), 
				// make this searchable by .tasks.named(..)...
				{ 
					__session_task__: !!action.__session_task__,
					name: action.name, 
				}) }),
		{
			title,
			toString: function(){
				return `core.taskAction('${ action.name }', \n\t${ 
					object.normalizeIndent('\t'+func.toString()) })` },
		})) }

var sessionTaskAction =
module.sessionTaskAction =
function(title, func){
	return object.mixin(
		taskAction(...arguments),
		{ __session_task__: true }) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// Queued wrapper...
var Queued =
module.Queued =
function(func){
	func.__queued__ = true
	return Task(func) }


// Queued action...
// 
//	queuedAction(title, func)
//	queuedAction(title, options, func)
//		-> action
//
//	func(..)
//		-> res
//
//	action(..)
//		-> promise(res)
//
//
// The idea here is that each time a queued action is called it is run 
// in a queue, and while it is running all consecutive calls are queued
// and run according to the queue policy.
//
//
// NOTE: for examples see:
// 		features/examples.js: 
// 			ExampleActions.exampleQueuedAction(..)
// 			ExampleActions.exampleMultipleQueuedAction(..)
//
// XXX handle errors... (???)
// XXX revise logging and logger passing...
var queuedAction = 
module.queuedAction =
function(title, func){
	var args = [...arguments]
	func = args.pop()	
	var [title, opts] = args

	var action
	return object.mixin(
		action = Queued(function(...args){
			var that = this
			return new Promise(function(resolve, reject){
				Object.assign(
					that.queue(title, opts || {})
						.push(function(){
							var res = func.call(that, ...args) 
							resolve(res)
							return res }),
			   		{ 
						__session_task__: !!action.__session_task__,
						title: action.name, 
					}) }) }),
   		{
			title,
			toString: function(){
				return `core.queuedAction('${action.name}',\n\t${ 
					object.normalizeIndent( '\t'+ func.toString() ) })` },
		}) }

var sessionQueueAction =
module.sessionQueueAction =
function(title, func){
	return object.mixin(
		queuedAction(...arguments),
		{ __session_task__: true }) }


// Queue action handler...
//
//	queueHandler(title[, opts], func)
//	queueHandler(title[, opts], arg_handler, func)
//		-> action
//
//	Chained queue handler...
//	queueHandler(title[, opts], queueHandler(..), func)
//		-> action
//
//
//	Prepare args...
//	arg_handler(queue, items, ...args)
//		-> [items, ...args]
//
//	Prepare args in sync mode...
//	arg_handler('sync', items, ...args)
//		-> [items, ...args]
//
//
//	Call action...
//	action(items, ...args)
//		-> promise
//
//	Call action in sync mode...
//	action('sync', items, ...args)
//		-> promise
//
//
//	Action function...
//	func(item, ...args)
//		-> res
//
//
// This is different from queuedAction(..) in that what is queued is not
// the action itself but rather the first argument to that action and the
// action is used by the queue to handle each item. The rest of the 
// arguments are passed to each call.
//
// In 'sync' mode the action is run outside of queue/task right away, this
// is done because for a queue we can only control the sync start, i.e. 
// the first task execution, the rest depends on queue configuration 
// thus making the final behaviour unpredictable.
//
//
// NOTE: promise results are .flat()-tened, thus if it is needed to return 
// 		a list of arrays then one must wrap the handler return value in an
// 		array...
// NOTE: sync-mode actions do not externally log anything, basic progress 
// 		logging is handled by the queue/task which is not created in sync
// 		mode.
// NOTE: since the sync-mode can block it must be used very carefully.
// NOTE: for an example of chaining several queues see features/examples's:
// 			.exampleChainedQueueHandler(..)
// NOTE: when chaining queues, in 'sync' mode all queues in the chain will
// 		be run sync...
// NOTE: when chaining arg_handler(..) will get one queue per level of 
// 		chaining, but in 'sync' mode only one 'sync' is passed...
// NOTE: when calling this multiple times for the same queue each call 
// 		will call all the stages but since items are processes async the 
// 		later calls' later stages may end up with empty input queues, 
// 		e.g. for:
// 			[1,2,3].map(e => ig.exampleChainedQueueHandler(e))
// 		.exampleChainedQueueHandler(..) is called once per input and thus
// 		the first two stages are called sync and by the time the last 
// 		stage of the first call is triggered (async) all the inputs are 
// 		ready thus the first call will process all the inputs and the 
// 		later calls will get empty inputs (unless any new inputs are while 
// 		processing added)...
// 		i.e. within a queue/task async processing model there is no guarantee
// 		that the item will be processed in the same call tree that it 
// 		was added in...
//
// XXX might be a good idea to split this into a generic and domain parts 
// 		and move the generic part into types/runner...
// XXX check if item is already in queue (???)
// 		...how do we identify item uniqueness??
var queueHandler =
module.queueHandler =
function(title, func){
	var args = [...arguments]
	func = args.pop()	
	var arg_handler = 
		typeof(args.last()) == 'function' 
			&& args.pop()
	var [title, opts] = args

	var action
	return object.mixin(
		action = Queued(function(items, ...args){
			var that = this
			var inputs = [...arguments]

			// sync start...
			if(inputs[0] == 'sync' || inputs[0] == 'async'){
				var [sync, [items, ...args]] = [inputs.shift(), inputs] }

			// XXX see arg_handler(..) note below...
			var q

			// pre-process args (sync)...
			arg_handler
				&& (inputs = arg_handler.call(this, 
					sync == 'sync' ? 
						sync 
						// XXX should this be a queue???
						// 		...seems like this is either 'sync' or 
						// 		undefined but never a queue at this stage...
						: q, 
					...inputs))
			// special-case: empty inputs -- no need to handle anything...
			if(inputs instanceof Array 
					&& (inputs.length == 0
						|| (inputs[0] ?? []).length == 0)){
				return Promise.resolve(inputs[0] ?? []) }

			// Define the runner and prepare...
			//
			// sync mode -- run action outside of queue...
			// NOTE: running the queue in sync mode is not practical as
			// 		the results may depend on queue configuration and 
			// 		size...
			if(sync == 'sync'){
				var run = function([items, ...args]){
					return Promise.all(
						(items instanceof Array ? 
							items 
							: [items])
						.map(function(item){
							var res = func.call(that, item, ...args) 
							return res === runner.SKIP ? 
								[]
								: [res] })
						.flat()) }
			// queue mode...
			} else {
				// prep queue...
				q = that.queue(title,
					Object.assign(
						{},
						opts || {},
						{ 
							__session_task__: !!action.__session_task__,
							handler: function([item, args]){
								// XXX is this correct in all cases...
								item = item instanceof Array ?
									item.flat()
									: item
								return func.call(that, item, ...(args || [])) }, 
						}))
				q.title = action.name 

				var run = function([items, ...args]){
					// fill the queue...
					// NOTE: we are also adding a ref to args here to keep things consistent...
					args.length > 0
						&& (args = [args])
					q.add(items instanceof Array ? 
						items
							// move the inputs out of the input array...
							// NOTE: this will prevent the items from getting 
							// 		processed multiple times when the action 
							// 		is called multiple times...
							.splice(0, items.length)
							.map(function(e){ 
								return [e, ...args] }) 
						: [[items, ...args]])
					return q
			   			.then(function(res){ 
							// XXX we need to flatten this once and in-place...
							// 		...if we keep this code it will copy res 
							// 		on each call...
							// 		...if we splice the flattened data back 
							// 		into res it will be done on each call...
							//return res && res.flat() }) } } 
							// NOTE: we are compensating for this not being flat
							// 		in the queue handler above...
							return res }) } } 

			// run...
			return (inputs instanceof Promise 
					|| inputs instanceof runner.FinalizableQueue) ?
				inputs.then(
					function(items){
						return run([items, ...args]) },
					function(){
						q && q.abort() })
				: run(inputs) }),
   		{
			title,
			arg_handler,
			handler: func,

			toString: function(){
				// XXX add opts if given...
				return `core.queueHandler('${action.name}',\n${ 
					(arg_handler ?
						object.normalizeIndent('\t'+arg_handler.toString()).indent('\t') + ',\n'
						: '')
					+ object.normalizeIndent('\t'+func.toString()).indent('\t') })` },
		}) }

var sessionQueueHandler =
module.sessionQueueHandler =
function(title, func){
	return object.mixin(
		queueHandler(...arguments),
		{ __session_task__: true }) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX EXPERIMENTAL...
var LinkContext = 
module.LinkContext = ImageGridFeatures.Feature({
	title: '',
	tag: 'link-context',
	depends: [
		'changes',
	],

	actions: actions.Actions({
		title: null,
		// NOTE: we need .__parent to be able to test if we are fully 
		// 		detached in .type...
		// NOTE: this is maintained by .detachLink(..)...
		__parent: null,
		parent: null,

		get type(){
			return this.parent ?
					'link' 
				: (this.__parent
						&& (this.data !== this.__parent.data 
							|| this.images !== this.__parent.images)) ?
					'link-detached'
				: 'link-partial' },

		__changes: null, 
		get changes(){
			return this.parent ?
				this.parent.changes 
				: this.__changes },
		set changes(value){
			this.parent ? 
				(this.parent.changes = value)
	   			: (this.__changes = value)},

		// NOTE: .detachLink(false) is not intended for direct use as it
		// 		will create a partial link...
		detachLink: ['- System/',
			doc``,
			function(full=true){
				// partial detach...
				if(this.type == 'link'){
					// copy over .changes
					this.__changes = this.changes === undefined ?
						undefined
						: JSON.parse(JSON.stringify([this.changes]))[0]
					this.__parent = this.parent
					delete this.parent }
				// full detach...
				if(this.type != 'link-detached' && full){
					Object.assign(
						this,
						this.clone(true)) 
					// cleanup...
					// NOTE: we do not need to cleanup things outside of 
					// 		the full detach as this will be done in .links
					this.links.current === this
						&& (delete this.links.current)
					this.links.previous === this
						&& (delete this.links.previous) } }],
	}), })


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX add ability to trigger actions when:
// 		- all tasks are done and/or fail
// 		- all session tasks are done and/or fail
// 		...in theory this can be done via:
// 			ig.tasks
// 				.then(function(){ .. })
// 		but this is a bit too cumbersome...
// 		...do this via .chain(..)
// XXX revise logging and logger passing...
// XXX add a task manager UI...
// XXX might be a good idea to confirm session task stops when loading a 
// 		new index...
var TaskActions = actions.Actions({
	config: {
		'context-exclude-attrs': [
			// NOTE: these are commented out so as to reuse contexts where 
			// 		possible... (XXX)
			//'__links',
			//'__isolated',

			// keep all the tasks/queues in one pool...
			//
			// NOTE: a linked context in here can stop main tasks and 
			// 		vise versa...
			// XXX what else should we isolate from the clone???
			'__tasks',
			'__queues',

			// NOTE: we link the changes directly to the parent so no need to 
			//		copy them...
			'changes',

			// keep the local features as they are not the same as .parent.features
			'features',
		],
	},

	// Tasks...
	//
	isTask: function(action){
		return !!this.getActionAttr(action, '__task__') },
	isSessionTask: function(action){
		return !!this.getActionAttr(action, '__session_task__') },
	// list actions that generate tasks...
	// XXX cache these???
	get taskActions(){
		return this.cache('taskActions', function(data){
			return data 
				|| this.actions.filter(this.isTask.bind(this)) }) },
	get sessionTaskActions(){
		return this.cache('sessionTaskActions', function(data){
			return data 
				|| this.actions.filter(this.isSessionTask.bind(this)) }) },

	// task manager...
	//
	__task_manager__: runner.TaskManager,
	__tasks: null,
	get tasks(){
		return (this.__tasks = 
			this.__tasks 
				|| this.__task_manager__()) },
	// NOTE: session tasks are stopped when the index is cleared...
	// XXX do we need to cache this...
	// 		...if yes then we'll need to also clear/update the cache 
	// 		every time a task is run/stopped...
	get sessionTasks(){
		return this.tasks
			.filter(function(task){
				return task.__session_task__ }) },


	// Queue (task)...
	//
	isQueued: function(action){
		return !!this.getActionAttr(action, '__queued__') },
	// XXX cache this???
	// XXX need to get running tasks by action name...
	get queuedActions(){
		return this.cache('queuedActions', function(data){
			return data 
				|| this.actions.filter(this.isQueued.bind(this)) }) },

	// XXX need a way to reference the queue again...
	// 		.tasks.titled(name) will return a list...
	__queues: null,
	get queues(){
		return (this.__queues = this.__queues || {}) },

	// XXX test hidden progress...
	// XXX revise logging and logger passing...
	// XXX need better error flow...
	queue: doc('Get or create a queue task',
		doc`Get or create a queue task...

			.queue(name)
			.queue(name, options)
				-> queue

		If a queue with the given name already exits it will be returned 
		and options and logger are ignored.

		options format:
			{
				nonAbortable: <bool>,
				quiet: <bool>,
				hideProgress: <bool>,
				...
			}


		NOTE: when a task queue is stopped it will clear and cleanup, this is 
			different to how normal queue behaves.
		NOTE: for queue-specific options see ig-types/runner's Queue(..)
		`,
		function(name, options){
			var that = this

			var queue = this.queues[name]

			// create a new queue...
			if(queue == null){
				var abort = function(){
					options.nonAbortable
						|| queue
							.abort() }
				var cleanup = function(){
					return function(){
						queue.stop()
						// XXX handle error state...
						//logger
						//	&& logger.emit('close')
						delete that.queues[name] } }

				options = options || {}
				var logger = options.logger || this.logger
				//logger = logger && logger.push(name)
				logger = logger 
					&& logger.push(name, {onclose: abort, quiet: !!options.quiet})
				logger 
					&& (options.logger = logger)

				queue = this.queues[name] = 
					runner.FinalizableQueue(options || {})

				// setup logging...
				var suffix = (options || {}).hideProgress ? 
					' (hidden)' 
					: ''
				queue
					.on('tasksAdded', function(evt, t){ 
						this.logger && this.logger.emit('added'+suffix, t) })
					// NOTE: t can be anything including an array, so to 
					// 		avoid confusion we wrap it in an array this 
					// 		one call means one emit...
					.on('taskCompleted', function(evt, t, r){ 
						this.logger && this.logger.emit('done'+suffix, [t]) }) 
					.on('taskFailed', function(evt, t, err){ 
						this.logger && this.logger.emit('skipped'+suffix, t, err) }) 
					.on('stop', function(){
						this.logger && this.logger.emit('reset') })
					.on('abort', function(){
						this.logger && this.logger.emit('reset') })
				// cleanup...
				queue
					.then(
						cleanup('done'), 
						cleanup('error')) }

			// add queue as task...
			this.tasks.includes(queue)
				|| this.tasks.Task(name, queue) 

			return queue }),



	// contexts (XXX EXPERIMENTAL)
	//
	// XXX would be nice to have a context manager:
	// 		- context id's (index? ...sparse array?)
	// 		- manager API
	// 			- create/remove
	// 		- context api (feature) 
	// 			.then(..)/.catch(..)/.finally(..)
	// XXX is peer stuff just a special context???
	// 		...feels like yes
	// XXX is context manager a special case of task manager???
	// XXX move to a separate feature... (???)
	__contexts: null,
	get contexts(){},

	// XXX this should delete the clone when done...
	// XXX need a common context API to make management possible...
	ContextTask: ['- System/',
		doc``,
		function(type, action, ...args){
			var that = this
			var context = this[type]

			var res = context[action](...args)

			var cleanup = function(){
				// XXX
			}

			res.finally ?
				res.finally(cleanup)
				: cleanup()

			return res === context ? 
				undefined 
				: res }],
	
	// Links...
	//
	// NOTE: all links to current state in .links will be detached on .clear()
	__links: null,
	get links(){
		var links = this.__links = this.__links || {}
		// remove 'current' if it does not match the current index...
		// XXX revise the test...
		var c = links.current
		if(c && (c.data !== this.data || c.images !== this.images)){
			links.previous = c
			delete links.current }
		return links },
	get linked(){
		return this.link() },
	// XXX go through ImageGrid instance data and re-check what needs to 
	// 		be cloned...
	// XXX should this be a constructor???
	link: ['- System/',
		doc`Get/create links...

			Get/create link to current state...
			.link()
			.link('current')
				-> current-link

			Get link to previous state if present...
			.link('previous')
				-> previous-link
				-> undefined

			Get/create a titled link...
			.link(title)
				-> link

		A link is a separate ImageGrid instance that links to the parent's
		state and explicitly disabled ui features.

		A link will reflect the data changes but when the main index is 
		cleared or reloaded it will retain the old data.
		Care must be taken as this is true in both directions and changes 
		to link state are reflected on the link .parent, this is useful
		when updating state in the background but can bite the user if not
		used carefully. 

		This effectively enables us to isolate a context for long running 
		actions/tasks and make them independent of the main state.

		Example:
			ig.linked.readAllMetadata()


		NOTE: links are relatively cheap as almost no data is copied but
			they can be a source of a memory "leak" if not cleaned out 
			as they prevent data from being garbage collected...
		NOTE: 'current' and 'previous' links are reserved.
		NOTE: 'previous' are a special case as they can not be created 
			via .link(..).
		`,
		function(title='current'){
			var that = this
			var links = this.links
			// get link already created...
			// NOTE: 'current' and 'previous' links are handled by the 
			// 		.links prop...
			var link = links[title]
			if(link){
				return link }
			// prevent creating previous links...
			if(title == 'previous'){
				return actions.UNDEFINED }
			// create a link...
			// NOTE: we intentionally disable ui here and do not trigger .start()...
			return (links[title] = 
				Object.assign(
					// new base object...
					// XXX add a 'link' feature...
					ImageGridFeatures.setup([
						...this.features.input, 
						'-ui',
						'link-context',
					]),
					// clone data...
					// NOTE: this can shadow parts of the new base object 
					// 		so we'll need to exclude some stuff...
					Object.assign({}, this)
						.run(function(){
							// remove excluded attrs...
							;(that.config['context-exclude-attrs'] 
									|| [ 'features' ])
								.forEach(function(key){
									delete this[key] }.bind(this)) }),
					// context-specific data...
					{
						// link metadata...
						parent: this,
						title: title,
						// link configuration...
						logger: that.logger
							.push(`Linked ${ Object.keys(links).length }`),
					})
				// detach link on parent .clear(..)...
				.run(function(){
					var link = this
					that.one('clear.pre', function(){
						// NOTE: we are doing a partial detach here as the 
						// 		parent is overwriting its data and we do not
						// 		need to clone it...
						link.detachLink(false) }) })) }],


	// XXX would be nice to have an ability to partially clone the instance...
	// 		...currently we can do a full clone and remove things we do 
	// 		not want...
	// XXX this does not copy aliases...
	// XXX might be a good idea to add a 'IsolatedTask' feature/mixin to
	// 		handle cleanup (via .done() action)
	// XXX should this be a prop -- .isolated???
	__isolated: null,
	get isolated(){
		return (this.__isolated = this.__isolated || []) },
	// XXX should this be a constructor???
	isolate: ['- System/',
		function(){
			var clones = this.isolated

			var clone = this.clone(true)
			// reset actions to exclude UI...
			clone.__proto__ = ImageGridFeatures.setup([...this.features.input, '-ui'])
			clone.parent = this
			// link clone in...
			clone.logger = this.logger.push(['Task', clones.length].join(' '))

			clone.context_id = clones.push(clone)
			return clone }],

})

var Tasks = 
module.Tasks = ImageGridFeatures.Feature({
	title: '',

	tag: 'tasks',

	depends: [ ],

	actions: TaskActions,

	handlers: [
		// stop session tasks...
		['clear',
			'sessionTasks.abort'],
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
	return func }

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
					&& logger.emit('done', action) }) })],
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
* vim:set ts=4 sw=4 nowrap :                        */ return module })
