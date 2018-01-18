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

var ConfigFS = actions.Actions({
	config: {
	},

})


var ConfigLocalStorage = 
module.ConfigLocalStorage = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-config',
	depends: [
		'config-local-storage',
		'fs',
	],

	actions: ConfigFS,

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
