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
	},

	__base_config: null,

	
	// XXX
	storeConfig: ['File/Store configuration',
		function(key){
			// XXX this.saveData('*:config')
		}],
	// XXX
	loadConfig: ['File/Load stored configuration',
		function(key){
			// XXX
		}],
	// XXX should this also reload???
	resetConfig: ['- Config/',
		function(){
			var base = this.__base_config = this.__base_config || this.config
			this.config = Object.create(base)
		}],

	// XXX use timer events... (???)
	// XXX this needs a working .storeConfig(..)
	toggleAutoStoreConfig: ['File/Store configuration',
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
			function(res){
				//var ls_path = '/${ROOT_PATH}/config'
				var ls_path = 'config'

				// localStorage...
				// NOTE: we do not need to clone anything here as this 
				// 		will be done by the localStorage handler...
				if(res.data.storage){
					res.data.storage[ls_path] = this.config
				}

				if(res.data.fsJSONSync){
					// XXX should this include path???
					res.data.fsJSONSync[this.config['config-fs-filename'] || '.ImageGrid.json'] = this.config
				}
			}],
		['prepareIndexForLoad',
			function(){
			}],
		// NOTE: this is sync for sync stores...
		['storeDataLoaded',
			function(data){
				var base = this.__base_config = this.__base_config || this.config
				//var ls_path = '/${ROOT_PATH}/config'
				var ls_path = 'config'

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
					&& this.toggleAutoStoreConfig('?') == 'off'
					&& this.toggleAutoStoreConfig()
			}],
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
