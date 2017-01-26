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
* 	- lifecycle
* 		base life-cycle events (start/stop/..)
* 	- util
* 	- introspection
* 	- journal
* 		action journaling and undo/redo functionality
* 		XXX needs revision...
* 	- workspace
* 		XXX needs revision...
* 	- tasks
* 		XXX not yet used
* 	- self-test
* 		basic framework for running test actions at startup...
*
*
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

// Make a protocol implementation action...
//
// For more docs see: docs for actions.js and .chainApply(..)
//
// XXX might be good to move this to actions.js
// XXX might also be a good idea to mark the actual protocol definition
// 		and not just the implementation...
var protocol =
module.protocol = function(protocol, func){
	return function(){
		return this[protocol].chainApply(this, func, arguments)
	}
}


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
			var lst = states.constructor === Array ? states 
				: states instanceof Function ? states.call(this)
				: states

			if(action == null){
				var cfg = this.config[attr]
				return cfg == null ? 
					(lst[lst.indexOf('none')] || lst[0])
					: cfg 

			} else {
				this.config[attr] = action
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
	isToggler: actions.doWithRootAction(function(action){
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
	object.makeConstructor('ImageGrid', ImageGridMetaActions)

// Root ImageGrid feature set....
var ImageGridFeatures =
module.ImageGridFeatures = new features.FeatureSet()

// setup base instance constructor...
ImageGridFeatures.__actions__ = 
	function(){ return actions.Actions(ImageGrid()) }



//---------------------------------------------------------------------
// Setup runtime info...

// nw or node...
if(typeof(process) != 'undefined'){

	// nw.js 0.13+
	if(typeof(nw) != 'undefined'){
		ImageGridFeatures.runtime = 'nw'

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
		ImageGridFeatures.runtime = 'node'

		// XXX patch Date...
		// XXX this will not work directly as we will need to explicitly
		// 		require jli...
		//patchDate(global.Date)
	}

// browser...
// NOTE: we're avoiding detecting browser specifics for as long as possible,
// 		this will minimize the headaches of supporting several non-standard
// 		versions of code...
} else if(typeof(window) != 'undefined'){
	ImageGridFeatures.runtime = 'browser'

// unknown...
// XXX do we need to detect chrome app???
} else {
	ImageGridFeatures.runtime = 'unknown'
}



/*********************************************************************/
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
var doc = 
module.doc =
function(strings, ...values){
	var lines = strings
		.map(function(s, i){ return s + (values[i] || '') })
		.join('')
		.split(/\n/g)

	// get the common whitespae offset...
	var l = -1
	lines.forEach(function(line, i){ 
		if(line.trim().length == 0){
			return
		}

		// get the indent...
		var a = line.length - line.trimLeft().length

		// if line 0 is not indented, ignore it...
		if(i == 0 && a == 0){
			return
		}

		l = l < 0 ? a : Math.min(l, a)
	})

	return lines
		.map(function(line, i){ return i == 0 ? line : line.slice(l) })
		.join('\n')
}


// Indicate that an action is not intended for direct use...
//
// NOTE: this will not do anything but mark the action.
var notUserCallable =
module.notUserCallable = 
function(func){
	func.__not_user_callable__ = true
	return func
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

var IntrospectionActions = actions.Actions({
	// user-callable actions...
	get useractions(){
		return this.actions.filter(this.isUserCallable.bind(this)) },

	// check if action is callable by user...
	isUserCallable: ['- System/',
		doc`Test if an action is used callable.`,
		actions.doWithRootAction(function(action){
			return action.__not_user_callable__ != true })],
})


var Introspection = 
module.Introspection = ImageGridFeatures.Feature({
	title: '',

	tag: 'introspection',

	actions: IntrospectionActions,
})



//---------------------------------------------------------------------
// System life-cycle...

// XXX should this be a generic library thing???
// XXX should his have state???
// 		...if so, should this be a toggler???
var LifeCycleActions = actions.Actions({
	start: ['- System/', 
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
			if(runtime == 'nw'){
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


			// node.js...
			} else if(runtime == 'node'){
				process.on('exit', stop)

			// browser...
			} else if(runtime == 'browser'){
				$(window).on('beforeunload', stop)

			// other...
			} else {
				// XXX
				console.warn('Unknown runtime:', runtime)
			}

			// handler ready event...
			// ...if no one requested to do it.
			if(this.__ready_announce_requested == null
					|| this.__ready_announce_requested <= 0){
				if(runtime == 'nw'){
					$(function(){ that.declareReady() })

				} else if(runtime == 'node'){
					this.declareReady()

				} else if(runtime == 'browser'){
					$(function(){ that.declareReady() })

				} else {
					this.declareReady()
				}
			}
		}],

	ready: ['- System/System ready event',
		doc`Ready protocol event

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
	   	notUserCallable(function(){
			// System ready event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			this.logger && this.logger.emit('start')
		})],
	// NOTE: this calls .ready() once per session.
	declareReady: ['- System/Declare system ready', 
		function(){
			this.__ready_announce_requested
				&& (this.__ready_announce_requested -= 1)

			if(!this.__ready_announce_requested 
					|| this.__ready_announce_requested == 0){
				this.__ready = this.__ready || !!this.ready() 
				delete this.__ready_announce_requested
			}
		}],
	requestReadyAnnounce: ['- System/',
		function(){
			return this.__ready_announce_requested = (this.__ready_announce_requested || 0) + 1
		}],

	// unbind events...
	stop: ['- System/', 
		function(){
			// browser & nw...
			if(this.__stop_handler 
					&& (this.runtime == 'browser' || this.runtime == 'nw')){
				$(window).off('beforeunload', this.__stop_handler)
			}

			// nw...
			if(this.__nw_stop_handler && this.runtime == 'nw'){
				nw.Window.get().removeAllListeners('close')
				delete this.__nw_stop_handler
			}

			// node...
			if(this.__stop_handler && this.runtime == 'node'){
				process.removeAllListeners('exit')
			}

			delete this.__ready
			delete this.__stop_handler

			this.logger && this.logger.emit('stop')
		}],

	/*
	// XXX need a clear protocol for this...
	// 		something like:
	// 			- clear state
	// 			- load state
	reset: ['System/',
		function(){
		}],
	*/
})

var LifeCycle = 
module.LifeCycle = ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'lifecycle',
	priority: 'high',

	actions: LifeCycleActions,
})


//---------------------------------------------------------------------

var UtilActions = actions.Actions({
	mergeConfig: ['- System/', 
		function(config){
			config = config instanceof Function ? config.call(this)
				: typeof(config) == typeof('str') ? this.config[config]
				: config
			var that = this
			Object.keys(config).forEach(function(key){
				that.config[key] = config[key]
			})
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

	updateJournalableActions: ['System/Update list of journalable actions',
		function(){
			var that = this

			var handler = function(action){
				return function(){
					var cur = this.current
					var args = args2array(arguments)

					return function(){
						this.journalPush({
							type: 'basic',

							action: action, 
							args: args,
							// the current image before the action...
							current: cur, 
							// the target (current) image after action...
							target: this.current, 
						})
					}
				}
			}

			this.journalable = this.actions
				.filter(function(action){
					return !!that.getActionAttr(action, 'undo') 
						|| !!that.getActionAttr(action, 'journal') 
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
	undo: ['Edit/Undo',
		{browseMode: function(){ 
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
							// pass journal structure as-is...
							this[undo].apply(this, a)
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
		{browseMode: function(){ 
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

		callback && callback.call(this, workspace)
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
		['stop', 
			function(){ 
				this.saveWorkspace() }],
	],
})



//---------------------------------------------------------------------
// Tasks...
// XXX should this be a separate module???

var tasks = require('lib/tasks')

// XXX see if a protocol can be practical here to:
// 		- serialize/restore jobs
// 		- ...
var TaskActions = actions.Actions({
	config: {
	},

	get jobs(){
		return this.__jobs
	},

	getJob: ['- Jobs/',
		function(name){
			name = name || this.data.newGid()

			// get/init task dict...
			var t = this.__jobs = this.__jobs || {}
			// get/init task...
			var job = t[name] = t[name] || tasks.Queue()
			job.name = name

			return job
		}],

	// XXX stop
})


var Tasks = 
module.Tasks = ImageGridFeatures.Feature({
	title: '',

	tag: 'tasks',

	depends: [ ],

	actions: TaskActions,

	handlers: [
		['start', 
			function(){ 
				// XXX prepare for recovery and recover...
			}],
		['stop', 
			function(){ 
				// XXX stop tasks and prepare for recovery...
			}],
	],
})



//---------------------------------------------------------------------
// Self test framework...

var selfTest =
module.selfTest = function(func){
	func.__self_test__ = true
	return func
}

var SelfTestActions = actions.Actions({
	config: {
		'run-selftest-on-start': true,
	},

	runSelfTest: ['System/Run self test',
		selfTest(function(mode){
			var that = this
			var logger = this.logger && this.logger.push('Self test')

			var tests = this.actions
				.filter(function(action){ 
					return action != 'runSelfTest'
			   			&& (that[action].func.__self_test__ 
							|| that.getActionAttr(action, 'self_test'))})

			logger 
				&& tests.forEach(function(action){ 
					logger.emit('found', action) })


			tests.forEach(function(action){
				that[action]()

				logger.emit('done', action)
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
	priority: 'low',

	actions: SelfTestActions, 

	handlers: [
		['start',
			function(){ 
				this.config['run-selftest-on-start'] 
					&& this.runSelfTest() }]
	],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
