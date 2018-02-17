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
	get stores(){
		return this.cache('stores', function(d){
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
	// XXX need store client list (???)
	//get store_clients(){ return [] },

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


	// XXX do we need to parse date here???
	parseStoreQuery: ['- Store/',
		core.doc`

		Query syntax:
			<event>:<store>:<key>
			<store>:<key>
			<store>
			<key>

		Format:
			{
				query: <input-query>,
				date: <timestamp>,
				event: 'manual' | <event>,
				store: '*' | <store> | [<store>, ...]
				key: '*' | <key> | [<key>, ...]
			}

		`,
		function(query, date){
			var defaults = {
				date: date || Date.timeStamp(),
				event: 'manual',
				store: '*',
				key: '*',
			}

			// parse string...
			if(typeof(query) == typeof('str')){
				var res = {}
				res.query = query

				query = query.split(/:/g)

				res.event = query.length > 2 ? 
					query.shift()
					: defaults.event
				res.store = (this.stores[query[0]] || query.length > 1) ? 
					query.shift().split(/\|/g) 
					: defaults.store
				res.key = query.length > 0 ? 
					query.pop().split(/\|/g)
					: defaults.key
				res.date = date || defaults.date

				return res

			// get the defaults...
			} else if(query == null){
				return defaults

			// pass on the input...
			} else {
				if(date){
					query.date = date
				}
				return query
			}
		}],

	// base API...
	// XXX we need to be able to save/load specific part of the data...
	// 		...i.e. query by store and/or key...
	// 		the syntax could be:
	// 			<store>:<path>
	// 			<store>:<event>:<path>
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

		Format:
			{
				// metadata...
				mode: <mode>,
				data: <timestamp>,

				// the actual data...
				data: {
					<data-type>: {
						<data-key>: <data>,
						...
					},
					...
				},
			}
		`,
		function(query, data){ 
			var defaults = this.parseStoreQuery()
			query = this.parseStoreQuery(query)
			var stores = query.store || defaults.store

			// populate the store...
			data = data || {}
			Object.keys(this.stores)
				// only populate the requested handlers...
				.filter(function(store){ 
					return (stores == '*' 
							|| stores == 'all')
						|| stores == store
						|| stores.indexOf(store) >= 0  })
				.forEach(function(key){ data[key] = {} })

			return {
				date: query.date || Date.timeStamp(),

				event: query.event || defaults.event,
				key: query.key || defaults.key,

				data: data,
			} 
		}],
	// XXX use query???
	prepareStoreToLoad: ['- Store/',
		core.doc`
		
		NOTE: this can be called multiple times, once per each store.
		NOTE: only one store data set is included per call.`,
		function(data){ return data || {} }],
	// XXX this is different from .prepareIndexForWrite(..) in that there
	// 		is no default data set...
	// XXX async???
	saveData: ['- Store/',
		// XXX signature not final...
		function(query, data){
			var handlers = this.stores

			// save the given data...
			// NOTE: we are not calling .prepareStoreToSave(..) here, thus
			// 		we need not care about .key, .date, and other stuff...
			if(data){
				var defaults = this.parseStoreQuery()
				query = this.parseStoreQuery(query)

				if(query.store == defaults.store || query.key == defaults.key){
					console.error('saveData: at least "store" and "key" '
						+'must be explicitly set in query...')
					return
				}

				var d = {
					data: {}
				}
				var stores = query.store == '*' ? handlers : query.store
				stores = stores instanceof Array ? stores : [stores]
				stores.forEach(function(s){ 
					d.data[s] = {
						[query.key]: data,
					} })

				data = d

			// build the data...
			} else {
				data = this.prepareStoreToSave(query)
			}

			// iterate and handle stores...
			Object.keys(data.data).forEach(function(store){
				var handler = handlers[store]
				handler 
					&& this[handler].call(this, data.data[store])
			}.bind(this))
		}],
	// XXX add query support... (???)
	// 		...we can't support keys other than '*' until we register 
	// 		store keys...
	loadData: ['- Store/',
		function(query){
			var handlers = this.stores

			var defaults = this.parseStoreQuery()
			query = this.parseStoreQuery(query)

			query.store = query.store == defaults.store ? Object.keys(handlers) : query.store
			query.store = query.store instanceof Array ? query.store : [query.store]

			// XXX need to filter loading by query.key...
			var data = {}
			return Promise
				.all(query.store
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
			var handlers = this.stores

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

// NOTE: the doc is reused for both localStorage and sessionStorage with 
// 		appropriate automated changes...
var __storageHandler_doc = 
	core.doc`Handle localStorage store data...

		Get localStorage data...
		.localStorageDataHandler()
			-> data

		Save data set to localStorage...
		.localStorageDataHandler(data)
			-> this

		Save data to key in localStorage...
		.localStorageDataHandler(data, key)
			-> this

		Delete all data from localStorage...
		.localStorageDataHandler(null)
			-> this


	NOTE: load resolves to the same keys as were passed to load, while
		localStorage stores the expanded keys...
			'/$\{ROOT_PATH}/path' 
				--(store)--> this.config['store-root-key'] +'/path'
				--(load)--> '/$\{ROOT_PATH}/path' 


	Root keys of data partially support path syntax:
		'/key' or '../key'		
			stored in localStorage[key]
		'./key' or 'key'
			stored as-is in localStorage[this.config['store-root-key']]


	Path variables:
		$\{ROOT_PATH}	- resolves to .config['store-root-key']
							NOTE: './key' and $\{ROOT_PATH}/key are 
								not the same, the former will be stored in:
									localStorage[this.config['store-root-key']][key]
								while the later is stored in:
									localStorage[this.config['store-root-key/' + key]
								XXX not yet sure this is the right way to go...

	HOTE: other path syntax is ignored and the key will be saved as-is.
	`
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
		func.long_doc = __storageHandler_doc.replace(/localStorage/g, storage)
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

	// NOTE: for docs see __storageHandler_doc...
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
