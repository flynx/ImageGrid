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

// XXX might be a good idea to add "sandbox" mode -- i.e. all settings 
// 		are saved to sessionStorage and a re-open will load the old settings...
// XXX might be a good idea to add a .configLoaded(..) and .configChanged(..) 
// 		events thought it's not clear how are we going to track changes...
var ConfigStoreActions = actions.Actions({
	config: {
		// XXX should this include path???
		// 		...there should be modes:
		// 			- 'read-only'	-- don't save...
		// 			- 'portable'	-- use APP dir
		// 			- 'normal'		-- use $HOME
		'config-fs-filename': '.ImageGrid.json',

		'config-auto-save-interval': 1000*5,

		'config-load-sequence': [
			// localStorage...
			'storage:${INSTANCE}/config',

			// FS...
			// XXX should we load both or just one???
			'fileSync:${APP}/.ImageGrid.json',
			'fileSync:${HOME}/.ImageGrid.json',

			// temporary config...
			// NOTE: this is active until we re-open the app...
			'session:${INSTANCE}/config',
		],
	},

	__config_base: null,
	__config_loaded_from: null,

	// XXX handle save order -- need to save to one location only...
	// 		...use: .__config_loaded_from in reverse order (stop on session:..)
	// XXX keep record of what we loaded...
	// XXX should we only support sync stores??? (current state)
	loadConfig: ['File/Load configuration',
		core.doc`

		NOTE: might need to reload after this.
		`,
		function(query){
			// store loaded...
			var loaded = this.__config_loaded_from = []

			this.resetConfig()

			// do the load...
			;(query ? 
					(query instanceof Array ? query : [query])
					: (this.config['config-load-sequence'] || ['storage:config']))
				.forEach(function(query){
					query = this.parseStoreQuery(query)
					var cfg = this.loadStore(query)

					// select store...
					cfg = query.store
						.map(function(store){ return cfg[store] })
						.filter(function(cfg){ return Object.keys(cfg).length > 0 })
						.shift() || {}
					// select key...
					cfg = query.key
						.map(function(key){ return cfg[key] })
						.filter(function(cfg){ return !!cfg })
						.shift()

					// merge the config...
					cfg 
						&& Object.assign(this.config, cfg)
						&& loaded.push(query.query)
				}.bind(this))
		}],
	storeConfig: ['File/Save configuration',
		function(query){
			// XXX
			this.saveStore(query || 'storage:${INSTANCE}/config') 
		}],
	// XXX this needs to be confirmed...
	resetConfig: ['File/Reset configuration',
		core.doc`

		NOTE: might need to reload after this.
		`,
		function(){
			var base = this.__config_base = this.__config_base || this.config
			this.config = Object.create(base)
		}],

	// XXX use timer events... (???)
	toggleConfigAutoStore: ['File/Auto-save configuration',
		toggler.Toggler(null, 
			function(_, state){ 
				var timer = 'config-auto-save-timer'

				if(state == null){
					return this.isPersistentInterval(timer) || 'none'

				} else {
					var that = this
					var interval = this.config['config-auto-save-interval']

					// no timer interval set...
					if(!interval){
						return false
					}

					// start/restart...
					if(state == 'running' && interval){
						this.setPersistentInterval(timer, 'storeConfig', interval*1000)

					// stop...
					} else {
						this.clearPersistentInterval(timer)
					}
				}
			},
			'running')],
	

	// XXX does not work yet... 
	toggleConfigSandbox: ['- File/',
		toggler.Toggler(null, 
			function(_, state){ 

				if(state == null){
					return Object.keys(this.store('session:${INSTANCE}/config').session).length > 0 || 'none'

				} else if(state == 'sandboxed'){
					this.store('session:${INSTANCE}/config', undefined)

				} else {
					this.storeConfig('session:${INSTANCE}/config')
				}
			},
			'sandboxed')],
})

var ConfigStore = 
module.ConfigStore = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'store-config',
	priority: 80,
	depends: [
		'timers',
		'store-localstorage',
	],
	suggested: [
		'store-fs-json-sync',
	],

	actions: ConfigStoreActions,

	handlers: [
		// XXX need to update rather than rewrite things...
		['prepareStoreToSave', 
			function(res, query, data){
				var ls_path = '${INSTANCE}/config'
				//var ls_path = 'config'
				query = this.parseStoreQuery(query)
				
				// config not requested...
				if(query.key != '*' 
						&& query.key.indexOf('config')
						&& query.key.indexOf(ls_path)){
					return
				}

				// localStorage...
				// NOTE: we do not need to clone anything here as this 
				// 		will be done by the localStorage handler...
				if(query.store.indexOf('storage') >= 0){
					//res.data.storage[ls_path] = this.config
					res.data.storage[ls_path] = data || this.config
				}

				if(query.store.indexOf('fileSync') >= 0){
					// XXX should this include path???
					//res.data.fileSync[this.config['config-fs-filename'] || '.ImageGrid.json'] = this.config
					res.data.fileSync[this.config['config-fs-filename'] || '.ImageGrid.json'] = data || this.config
				}
			}],
		//['prepareIndexForLoad',
		//	function(){
		//	}],
		// NOTE: this is sync for sync stores...
		['storeDataLoaded',
			function(_, store, data){
				var base = this.__config_base = this.__config_base || this.config
				var ls_path = '${INSTANCE}/config'

				// XXX sort out load priority/logic...
				// 		- one or the other or both?
				// 		- what order?

				if((data.storage || {})[ls_path]){
					var config = data.storage[ls_path] || {}
					config.__proto__ = base
					this.config = config
				}

				if((data.fsJSONSync || {}).config){
					var config = data.fsJSONSync.config || {}
					config.__proto__ = base
					this.config = config
				}

				// auto-start auto-save...
				this.config['config-auto-save-interval'] > 0 
					&& this.toggleConfigAutoStore('?') == 'off'
					&& this.toggleConfigAutoStore()
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
