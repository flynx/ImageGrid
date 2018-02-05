/**********************************************************************
* 
* Features:
*	- config
*		general config API
*	- localstorage-config
*		maintain configuration state in localStorage
*	- fs-config
*		maintain configuration state in file system
*
* XXX this module need refactoring...
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// XXX move store to a separate module...

// XXX should we unify this with the save/load API
var StoreActions = actions.Actions({
	config: {
		// Storage mode...
		//
		// This can be:
		// 	'read-only'
		// 	'read-write'
		// 	null			- ignore store
		//
		// NOTE: this only affects start/stop/timer event handling, manual
		// 		call to .loadData(..) / .saveData(..) are not affected...
		'store-mode': 'read-write',
	},

	// Store handler dict...
	//
	// Format:
	// 	{
	// 		<store-tag>: <handler-action>,
	// 		...
	// 	}
	//
	// XXX this is almost the same as .collection_handlers...
	get store_handlers(){
		return this.cache('store_handlers', function(d){
			var res = {}

			this.actions.forEach(function(action){ 
				var store = this.getActionAttr(action, 'handle_data_store')
				res[store]
					&& console.warn('Multiple handlers for store:', store)
				if(store){
					res[store] = action
				}
			}.bind(this))

			return res
		}) },

	// events...
	storeDataLoaded: ['- Store/',
		core.doc`Store data loaded event...

		This is tirggered as soon per store as soon as data is loaded, 
		this is sync for sync stores.

		NOTE: only one store data set is included per call.`,
		core.notUserCallable(function(data){
			// Store data loaded event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			return data
		})],

	// base API...
	prepareStoreToSave: ['- Store/',
		core.doc`

		Modes:
			'fast'		- fast timer
			'full'		- full store

		Format:
			{
				// metadata...
				mode: <mode>,
				data: <timestamp>,

				// the actual data...
				store: {
					<store-type>: {
						<data-key>: <data>,
						...
					},
					...
				},
			}
		`,
		function(mode, date){ 
			var store = {}
			// populate the store...
			Object.keys(this.store_handlers)
				.forEach(function(key){ store[key] = {} })
			return {
				mode: mode || 'full',
				date: date || Date.timeStamp(),

				store: store,
			} 
		}],
	prepareStoreToLoad: ['- Store/',
		core.doc`
		
		NOTE: this can be called multiple times, once per each store.
		NOTE: only one store data set is included per call.`,
		function(data){ return data || {} }],
	// XXX async???
	saveData: ['- Store/',
		function(mode, date){
			var handlers = this.store_handlers
			var data = this.prepareStoreToSave(mode, date)
			
			Object.keys(data.store).forEach(function(store){
				var handler = handlers[store]
				handler 
					&& this[handler].call(this, data.store[store])
			}.bind(this))
		}],
	loadData: ['- Store/',
		function(){
			var handlers = this.store_handlers
			var data = {}
			return Promise
				.all(Object.keys(handlers)
					.map(function(s){
						var res = this[handlers[s]]()
						return res instanceof Promise ?
							// async store...
							res.then(function(d){ d 
								&& (data[s] = d)
								&& this.storeDataLoaded(
									this.prepareStoreToLoad({[s]: d})) }.bind(this))
							// sync store...
							: (res 
								&& (data[s] = res)
								&& this.storeDataLoaded(
									this.prepareStoreToLoad({[s]: res})))
					}.bind(this))) 
				.then(function(){ return data })}],
	// XXX do we need to do a partial clear???
	clearData: ['- Store/',
		function(target){
			var handlers = this.store_handlers

			Object.keys(handlers).forEach(function(store){
				var handler = handlers[store]
				handler
					&& this[handler].call(this, null)
			}.bind(this))
		}],
})

var Store = 
module.Store = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'store',
	depends: [
		'cache',
	],
	suggested: [
		'store-localstorage',
	],
	isApplicable: function(){ return typeof(localStorage) != 'undefined' },

	actions: StoreActions,

	handlers: [
		['start.pre', 
			function(){ 
				if(this.config['store-mode'] != null){
					this.requestReadyAnnounce()
					this
						.loadData() 
						.then(function(){
							this.declareReady() }.bind(this)) 
				} }],
		['stop', 
			function(){ 
				this.config['store-mode'] == 'read-write' && this.saveData() }],
		// XXX timer???
		// XXX
	],
})


//---------------------------------------------------------------------

// XXX we should have a separate store config with settings of how to 
// 		load the store... (???)
var StoreLocalStorageActions = actions.Actions({
	// XXX get root key from config...
	// 		...this would require us to store the store config separately...
	localStorageDataHandler: ['- Store/',
		{handle_data_store: 'localStorage',},
		function(data){
			// XXX get this from config...
			var root = 'test-store-root-key'

			// clear...
			if(data === null){
				delete localStorage[root]

			// set...
			} else if(data){
				localStorage[root] = JSON.stringify(data)

			// get...
			} else {
				var d = localStorage[root]
				return d != undefined ? JSON.parse(d) : {}
			}
		}],
	sessionStorageDataHandler: ['- Store/',
		{handle_data_store: 'sessionStorage',},
		function(data){
			// XXX get this from config...
			var root = 'test-store-root-key'

			// clear...
			if(data === null){
				delete sessionStorage[root]

			// set...
			} else if(data){
				sessionStorage[root] = JSON.stringify(data)

			// get...
			} else {
				var d = localStorage[root]
				return d != undefined ? JSON.parse(d) : {}
			}
		}],
})

var StoreLocalStorage = 
module.StoreLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'store-localstorage',
	depends: [
		'store',
	],
	isApplicable: function(){ 
		return typeof(localStorage) != 'undefined' 
			&& typeof(sessionStorage) != 'undefined' },

	actions: StoreLocalStorageActions,
})


//---------------------------------------------------------------------

// XXX StoreFSJSONSync
// 		Lookup order:
// 			- app dir
// 			- $HOME

// XXX StoreFSJSON



/*********************************************************************/

var ConfigStoreActions = actions.Actions({
	config: {
		// XXX should this include path???
		// 		...there should be modes:
		// 			- 'read-only'	-- don't save...
		// 			- 'portable'	-- use APP dir
		// 			- 'normal'		-- use $HOME
		'config-fs-filename': '.ImageGrid.json',
	},

	__base_config: null,

	/* XXX
	// XXX should this also reload???
	resetConfig: ['- Config/',
		function(){
			var base = this.__base_config = this.__base_config || this.config
			this.config = Object.create(base)
		}],
	//*/
	/* XXX use timer events...
	toggleAutoStoreConfig: ['File/Store configuration',
		toggler.Toggler(null, 
			function(_, state){ 
				if(state == null){
					return this.__auto_save_config_timer || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// this cleans up before 'on' and fully handles 'off' action...
					if(this.__auto_save_config_timer != null){
						clearTimeout(this.__auto_save_config_timer)
						delete this.__auto_save_config_timer
					}

					if(state == 'running' 
							&& interval 
							&& this.__auto_save_config_timer == null){

						var runner = function(){
							clearTimeout(that.__auto_save_config_timer)

							//that.logger && that.logger.emit('config', 'saving to local storage...')
							that.storeConfig()

							var interval = that.config['config-auto-save-interval']
							if(!interval){
								delete that.__auto_save_config_timer
								return
							}
							interval *= 1000

							that.__auto_save_config_timer = setTimeout(runner, interval)
						}

						runner()
					}
				}
			},
			'running')],
	//*/
})

var ConfigStore = 
module.ConfigStore = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'store-config',
	priority: 80,
	depends: [
		'store-localstorage',
	],
	suggested: [
		'store-fs-json-sync',
	],

	actions: ConfigStoreActions,

	handlers: [
		['prepareStoreToSave', 
			function(res){
				// localStorage...
				// NOTE: we do not need to clone anything here as this 
				// 		will be done by the localStorage handler...
				res.store.localStorage.config = this.config

				// XXX sync fs store...
				// XXX get better tag...
				if(res.store.fsJSONSync){
					// XXX should this include path???
					res.store.fsJSONSync[this.config['config-fs-filename'] || '.ImageGrid.json'] = this.config
				}
			}],
		// NOTE: this is sync for sync stores...
		['storeDataLoaded',
			function(store){
				if((store.localStorage || {}).config){
					console.log('--- PRE LOAD CONFIG (test)')
					var base = this.__base_config = this.__base_config || this.config
					var config = store.localStorage.config || {}
					config.__proto__ = base
					// XXX set the config...
					// 		...disabled for now to avoid conflicts with 
					// 		legacy until we are ready to make the move...
					//this.config = config
				}

				// XXX sync fs store...
				// XXX get better tag...
				// XXX where do we write???
				if((store.fsJSONSync || {}).config){
					// XXX
				}
			}],
	],
})



/*********************************************************************/
// XXX might be a good idea to add an external payload mechanism for 
// 		other data to be saved to avoid re-implementing the same logic
// 		...like is done in features/history.js

var ConfigActions = actions.Actions({
	config: {
		'config-store-key': 'config',
		
		// NOTE: this is in seconds...
		// NOTE: if this is null or 0 the timer will not start...
		'config-auto-save-interval': 3*60,
	},

	// XXX should we store this in something like .default_config and
	// 		clone it???
	// 		...do not think so, as the __base_config should always be set
	// 		to the values set in code... (check this!)
	__base_config: null,
	__config_loaded: null,
	__auto_save_config_timer: null,


	// Disable localStorage in child, preventing two viewers from messing
	// things up in one store...
	clone: [function(){
		return function(res){
			res.config['config-store-key'] = null
		}
	}],

	// XXX make this a protocol to support multiple sources...
	// 		...load only one, by priority/order
	// 		might be good to make this similar to collections loading...
	storeConfig: ['File/Store configuration',
		function(key){
			// XXX
		}],
	loadConfig: ['File/Load stored configuration',
		function(key){
			// XXX
		}],
	// XXX need to load the reset config, and not just set it...
	resetConfig: ['File/Reset settings',
		function(){
			this.config = this.__base_config || this.config
		}],

	toggleAutoStoreConfig: ['File/Store configuration',
		toggler.Toggler(null, 
			function(_, state){ 
				if(state == null){
					return this.__auto_save_config_timer || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// this cleans up before 'on' and fully handles 'off' action...
					if(this.__auto_save_config_timer != null){
						clearTimeout(this.__auto_save_config_timer)
						delete this.__auto_save_config_timer
					}

					if(state == 'running' 
							&& interval 
							&& this.__auto_save_config_timer == null){

						var runner = function(){
							clearTimeout(that.__auto_save_config_timer)

							//that.logger && that.logger.emit('config', 'saving to local storage...')
							that.storeConfig()

							var interval = that.config['config-auto-save-interval']
							if(!interval){
								delete that.__auto_save_config_timer
								return
							}
							interval *= 1000

							that.__auto_save_config_timer = setTimeout(runner, interval)
						}

						runner()
					}
				}
			},
			'running')],
})


var Config = 
module.Config = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'config',
	depends: [
		'store',
	],
	priority: 80,
	suggested: [
		'localstorage-config',
		'fs-config',
	],

	actions: ConfigActions,

	handlers: [
		// NOTE: considering that allot depends on this it must be 
		// 		first to run...
		['start.pre',
			function(){ 
				console.log('--- PRE LOAD CONFIG')
				this.logger && this.logger
					.push('Startup')
						.emit('loaded', 'config')
				this
					.loadConfig() 
					.toggleAutoStoreConfig('on')
			}],
		['stop.pre',
			function(){ 
				this.logger && this.logger
					.push('Shutdown')
						.emit('stored', 'config')
				this
					.storeConfig() 
					.toggleAutoStoreConfig('off')
			}],
	],
})



//---------------------------------------------------------------------

var ConfigLocalStorageActions = actions.Actions({
	config: {
		// XXX not sure what should be the default...
		'config-local-storage-save-diff': true,
	},

	storeConfig: ['File/Store configuration',
		function(key){
			var key = key || this.config['config-store-key']

			if(key != null){
				// build a diff...
				if(this.config['config-local-storage-save-diff']){
					var base = this.__base_config || {}
					var cur = this.config
					var config = {}
					Object.keys(cur)
						.forEach(function(e){
							if(cur.hasOwnProperty(e) 
									&& base[e] != cur[e] 
									// NOTE: this may go wrong for objects
									// 		if key order is different...
									// 		...this is no big deal as false
									// 		positives are not lost data...
									|| JSON.stringify(base[e]) != JSON.stringify(cur[e])){
								config[e] = cur[e]
							}
						})

				// full save...
				} else {
					var config = this.config
				}

				// store...
				localStorage[key] = JSON.stringify(config) 
			}
		}],
	loadConfig: ['File/Load stored configuration',
		function(key){
			key = key || this.config['config-store-key']

			if(key && localStorage[key]){
				// get the original (default) config and keep it for 
				// reference...
				// NOTE: this is here so as to avoid creating 'endless'
				// 		config inheritance chains...
				base = this.__base_config = this.__base_config || this.config

				var loaded = JSON.parse(localStorage[key])
				loaded.__proto__ = base

				this.config = loaded 
			}
		}],
})


var ConfigLocalStorage = 
module.ConfigLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX rename???
	tag: 'localstorage-config',
	depends: [
		'config',
		'ui',
	],
	priority: 80,

	isApplicable: function(){ 
		return typeof(localStorage) != 'undefined' 
			&& localStorage != null },

	actions: ConfigLocalStorageActions,
})



//---------------------------------------------------------------------
// XXX store config locations:
// 		- app
// 		- home
// XXX config override location/filename to support portable apps...
// XXX comment support in json (preferably both reading and writing...)

var ConfigFSActions = actions.Actions({
	config: {
	},

})


var ConfigFS = 
module.ConfigFS = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-config',
	depends: [
		'localstorage-config',
		'fs',
	],

	actions: ConfigFSActions,

	handlers: [
		// NOTE: considering that allot depends on this it must be 
		// 		first to run...
		['loadConfig',
			function(){ 
			}],
		['storeConfig',
			function(){ 
			}],
	],
})



//---------------------------------------------------------------------



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
