/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var actions = require('lib/actions')
var features = require('lib/features')

var core = require('features/core')



/*********************************************************************/
// XXX TODO:
// 		- key syntax (path)
// 			<store>:<path>
// 		- path variables
// 			$VAR or ${VAR}
// 		- ability to store/load only a specific key from a specific store
// 			Q: path patterns??
// 				localstorage:*		- save/load everything on localstorage
// 				*:config			- save load config from all stores...

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
		core.Event(function(data){
			// Store data loaded event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			return data
		})],

	// base API...
	// XXX we need to be able to save/load specific part of the data...
	// 		...i.e. query by store and/or key...
	// 		the syntax could be:
	// 			<store>:<path>
	//
	// 		Example:
	// 			'localstorage:config'	- save config to localStorage
	// 			'localstorage:*'		- save all to localstorage
	// 			'*:config'				- save config to all supported stores
	// 			'*:*'					- save everything
	//
	// 		...this must be supported by .prepareStoreToSave(..)
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
		function(mode, data){ 
			var store = {}
			// populate the store...
			Object.keys(this.store_handlers)
				.forEach(function(key){ store[key] = {} })
			return {
				mode: mode || 'full',
				data: data || Date.timeStamp(),

				store: store,
			} 
		}],
	prepareStoreToLoad: ['- Store/',
		core.doc`
		
		NOTE: this can be called multiple times, once per each store.
		NOTE: only one store data set is included per call.`,
		function(data){ return data || {} }],
	// XXX async???
	// XXX we need to be able to save/load specific part of the data...
	// 		...i.e. query by store and/or key...
	// 		the syntax could be:
	// 			<store>:<path>
	//
	// 		Example:
	// 			'localstorage:config'	- save config to localStorage
	// 			'localstorage:*'		- save all to localstorage
	// 			'*:config'				- save config to all supported stores
	// 			'*:*'					- save everything
	//
	// 		...this must be supported by .prepareStoreToSave(..)
	// XXX API
	// 		.storeData(mode)			- store all with mode...
	// 		.storeData(mode, data)		- store data with mode...
	// 		.storeData(selector)		- store only matching
	// 		.storeData(selector, data)	- store data to selector...
	// XXX do we need mode here???
	saveData: ['- Store/',
		function(mode, data){
			var handlers = this.store_handlers
			var data = this.prepareStoreToSave(mode, data)
			
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

function makeStorageHandler(storage){
	var func = function(data, key){
		storage = typeof(storage) == typeof('str') ? window[storage] : storage

		var root_pattern = /^(\.\.)?[\\\/]/
		var root = this.config['store-root-key'] 

		var resolvePath = function(p){
			return p
				.replace('${ROOT_PATH}', root)
				.replace(root_pattern, '') }

		// clear...
		if(data === null){
			var d = storage[root]
			d = d != undefined ? JSON.parse(d) : {}
			;(d.__root_paths__ || [])
				.forEach(function(p){
					var key = resolvePath(p)
					delete storage[key] })
			delete storage[root]

		// set...
		} else if(data){
			if(key){
				data = { key: data }
			}

			var root_data = {}
			var root_paths = []

			// handle root paths...
			Object.keys(data)
				.forEach(function(p){
					if(root_pattern.test(p)){
						var key = resolvePath(p)
						root_paths.push(p)
						root_data[key] = JSON.stringify(data[p])
						delete data[p]
					}
				})
			data.__root_paths__ = root_paths


			storage[root] = JSON.stringify(data)

			// store root stuff...
			Object.assign(storage, root_data)

		// get...
		} else {
			var d = storage[root]
			d = d != undefined ? JSON.parse(d) : {}

			// load root paths...
			;(d.__root_paths__ || [])
				.forEach(function(p){
					var key = resolvePath(p)
					var o = storage[key]
					o = o != undefined ? JSON.parse(o) : o

					d[p] = o 
				})
			delete d.__root_paths__

			return d
		}
	}

	if(typeof(storage) == typeof('str')){
		func.long_doc = core.doc`Handle ${storage} store data...

			Get ${storage} data...
			.${storage}DataHandler()
				-> data

			Save data set to ${storage}...
			.${storage}DataHandler(data)
				-> this

			Save data to key in ${storage}...
			.${storage}DataHandler(data, key)
				-> this

			Delete all data from ${storage}...
			.${storage}DataHandler(null)
				-> this


		NOTE: load resolves to the same keys as were passed to load, while
			${storage} stores the expanded keys...
				'/$\{ROOT_PATH}/path' 
					--(store)--> this.config['store-root-key'] +'/path'
					--(load)--> '/$\{ROOT_PATH}/path' 


		Root keys of data partially support path syntax:
			'/key' or '../key'		
				stored in ${storage}[key]
			'./key' or 'key'
				stored as-is in ${storage}[this.config['store-root-key']]


		Path variables:
			$\{ROOT_PATH}	- resolves to .config['store-root-key']
								NOTE: './key' and $\{ROOT_PATH}/key are 
									not the same, the former will be stored in:
										${storage}[this.config['store-root-key']][key]
									while the later is stored in:
										${storage}[this.config['store-root-key/' + key]
									XXX not yet sure this is the right way to go...

		HOTE: other path syntax is ignored and the key will be saved as-is.
		`
	}

	return func
}


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX we should have a separate store config with settings of how to 
// 		load the store... (???)
var StoreLocalStorageActions = actions.Actions({
	config: {
		'store-root-key': 'ImageGrid.Viewer.main',
	},

	// NOTE: for docs see makeStorageHandler(..)
	localStorageDataHandler: ['- Store/',
		{handle_data_store: 'localStorage',},
		makeStorageHandler('localStorage')],
	sessionStorageDataHandler: ['- Store/',
		{handle_data_store: 'sessionStorage',},
		makeStorageHandler('sessionStorage')],
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



//---------------------------------------------------------------------

// XXX StoreFSJSON




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
