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
// 		- path variables syntax
// 			$VAR or ${VAR}
// 		- general path variables:
// 			${INSTANCE}		(DONE)
// 			...
// 		- specific path variables
// 			fs -> system env variables
// 			... 

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
	// XXX might be a good idea to shift this from meaning "store handlers" 
	// 		to "store APIs", i.e. mark all specific store actions with 
	// 		store tag and collect/group them for reference...
	// 			new format:
	// 				{
	// 					<store-tag>: [
	// 						<action-name>,
	// 						...
	// 					],
	// 					...
	// 				}
	// 		...might also be a good idea to split this to:
	// 			.stores				- list of store tags (i.e. Object.keys(this.stores_actions))
	// 			.stores_actions		- dict of store-specific actions
	get stores(){
		return this.cache('stores', function(d){
			return d ?
				Object.assign({}, d)
				: this.actions
					.reduce(function(res, action){ 
						var store = this.getActionAttr(action, 'handle_data_store')
						res[store]
							&& console.warn('Multiple handlers for store:', store)
						if(store){
							res[store] = action
						}
						return res
					}.bind(this), {}) }) },

	// events...
	// XXX update signature -- see doc for: .loadStore(..)
	storeDataLoaded: ['- Store/',
		core.doc`Store data loaded event...

		This is tirggered as soon per store as soon as data is loaded, 
		this is sync for sync stores.

		NOTE: only one store data set is included per call.`,
		core.Event(function(store, data){
			// Store data loaded event...
			//
			// Not intended for direct use, use .declareReady() to initiate.
			return data
		})],


	// base API...
	// XXX .stores: see .stores notes above for new semantics...
	parseStoreQuery: ['- Store/',
		core.doc`

			Get default query...
			.parseStoreQuery()
				-> defaults

			Get unexpanded default query...
			.parseStoreQuery(true)
				-> defaults

			Parse query...
			.parseStoreQuery(query)
				-> query

			Parse query without expanding...
			.parseStoreQuery(query, true)
				-> query


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
		function(query, no_expand){
			var defaults = {
				date: Date.timeStamp(),
				event: 'manual',
				store: '*',
				key: '*',
			}
			if(query === true || query === false){
				no_expand = query
				query = null
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
					//: Object.keys(this.stores)
				res.key = query.length > 0 ? 
					query.pop().split(/\|/g)
					: defaults.key
				res.date = defaults.date

				query = res

			// get the defaults...
			} else if(query == null){
				query = defaults

			// pass on the input...
			} else {
			}

			if(!no_expand){
				// XXX 
				var handlers = this.stores

				// expand store '*'...
				query.store = (query.store.length == 1 && query.store[0] == '*') ? 
					Object.keys(handlers) 
					: query.store
				// expand key '*'...
				query.key = query.key.length == 1 && query.key[0] == '*' ? 
					'*' 
					: query.key
			}

			return query
		}],


	// HL API...
	//
	// XXX sync or async or both???
	// 		...should we add an .onStore(query, handler) event/promise???
	// 		one way to do this is to place promises into res where async...
	store: ['- Store/',
		core.doc`

			Get stored key(s)...
			.store(query)
				-> value{s}

			Write value to key(s)...
			.store(query, value)

			Remove key(s)...
			.store(query, null)


		Returns:
			{
				<store>: {
					<key>: <value>,
					...
				},
				...
			}


		NOTE: for query syntax see .parseStoreQuery(..)


		Store API:
			- High-level API...
				.store(..)

			- Application-level API...
				.prepareStoreToLoad(..)
				.prepareStoreToSave(..)

			- Storage-level general API...
				.loadStore(..)
				.saveStore(..)
				.clearStore(..)

			NOTE: .prepareStoreToSave(..) is triggered only when no data
				is passed to .saveStore(..)...
			NOTE: .prepareStoreToLoad(..) is called every time .loadStore(..)
				is called...

		`,
		function(query, value){
			query = this.parseStoreQuery(query)
			return (
				// get...
				arguments.length == 1 ?
					this.loadStore(query)
				// delete...
				: (value === undefined && arguments.length == 2) ?
					this.clearStore(query)
				// set...
				: (this.saveStore(query, value) && undefined) ) }],

	// Application API...
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

			data = data || {}
			query.store.forEach(function(s){ data[s] = {} })

			return {
				date: query.date || Date.timeStamp(),

				event: query.event || defaults.event,
				key: query.key || defaults.key,

				data: data || {},
			} 
		}],
	prepareStoreToLoad: ['- Store/',
		core.doc`
		
		NOTE: this can be called multiple times, once per each store.
		NOTE: only one store data set is included per call.`,
		function(query, data){ 
			return data || {} }],

	// Store API...
	saveStore: ['- Store/',
		core.doc`

			Build and store all/query data...
			.saveStore()
			.saveStore(query)
				-> data

			Store query data...
			.saveStore(query, data)


		NOTE: this only calls .prepareStoreToSave(..) if no data is given...
		NOTE: the returned data is the same format as returned by .store(..)
		`,
		core.notUserCallable(function(query, data){
			// Extending action must:
			// 	- save query/data to it's store...
			return data == null ? 
				this.prepareStoreToSave(this.parseStoreQuery(query), {}).data
				: undefined
		})],
	loadStore: ['- Store/',
		core.doc`

			.loadStore(query)
				-> data


		NOTE: async stores will write promises to .data
		`,
		core.notUserCallable(function(query){
			// Extending action must:
			// 	- populate query from it's store...
			// 	- trigger .storeDataLoaded(store) event when done...
			//
			// NOTE: if query.store is a single value then the root object
			// 		must be populated, otherwise the appropriate section 
			// 		should be used...
			// 		e.g.
			// 			if(query.store.length == 1){
			//				res = data
			// 			} else {
			// 				res['store-key'] = data
			// 			}
			var res = {}
			var q = this.parseStoreQuery(query)
			query
				&& q.store.length >= 1
				&& q.store.forEach(function(s){ res[s] = {} })
			return this.prepareStoreToLoad(q, res)
		})],
	clearStore: ['- Store/',
		core.doc`

			.clearStore(query)


		`,
		core.notUserCallable(function(query){
			// Extending action:
			// 	- must clear query from it's store...
		})],



	// XXX LEGACY STUFF... (???)
	// 		...this is currently used to store config -- migrate to new API...


	// XXX this is different from .prepareIndexForWrite(..) in that there
	// 		is no default data set...
	// XXX async???
	saveData: ['- Store/',
		// XXX signature not final...
		function(query, data){
			var defaults = this.parseStoreQuery()
			query = this.parseStoreQuery(query)

			var handlers = this.stores

			// save the given data...
			// NOTE: we are not calling .prepareStoreToSave(..) here, thus
			// 		we need not care about .key, .date, and other stuff...
			if(data){
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
								&& this.storeDataLoaded(s,
									this.prepareStoreToLoad(query, {[s]: d})) }.bind(this))
							// sync store...
							: (res 
								&& (data[s] = res)
								&& this.storeDataLoaded(s,
									this.prepareStoreToLoad(query, {[s]: res})))
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
		'store-fs',
	],
	isApplicable: function(){ return typeof(localStorage) != 'undefined' },

	actions: StoreActions,

	handlers: [
		['start.pre', 
			function(){ 
				if(this.config['store-mode'] != null){
					this.requestReadyAnnounce('store')
					this
						.loadData() 
						.then(function(){
							this.declareReady('store') }.bind(this)) 
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
		
		Write data to key...
		.localStorageDataHandler(key, data)
		
		Get data from key...
		.localStorageDataHandler(key)
			-> value
		
		Remove key...
		.localStorageDataHandler(key, null)
		.localStorageDataHandler([key, ..], null)
		


		Get stored keys...
		.localStorageDataHandler('?')
			-> keys
		
		.localStorageDataHandler()
		.localStorageDataHandler('*')
		.localStorageDataHandler('??')
			-> data
		
		.localStorageDataHandler([key, ..], '??')
			-> data

		Expand data to store...
		.localStorageDataHandler(data)
		
		Remove all data...
		.localStorageDataHandler(null)
		
		
	NOTE: when handling key expansion the unexpanded key should be used 
		to access data, e.g. if writing '\${INSTANCE}/xyz' the same string
		is returned via .localStorageDataHandler('??') and should be used 
		to get the value, i.e. 
			.localStorageDataHandler('\${INSTANCE}/xyz')
	`
function makeStorageHandler(storage){
	var func = function(a, b){
		// normalize a...
		a = a == '??' ? '*' : a 

		storage = typeof(storage) == typeof('str') ? window[storage] : storage

		var instance = this.config['store-instance-key'] 
		var resolvePath = function(p){
			return p
				.replace('${INSTANCE}', instance) }

		var keys = Object.keys(storage)

		var dict_key = '${INSTANCE}/__dict__'
		var k = resolvePath(dict_key)
		var dict = JSON.parse(storage[k] || '{}')
		dict[k] = dict_key

		// get list of keys...
		if(a == '?'){
			return keys
				.map(function(key){ return dict[key] || key })

		// get store contents...
		} else if(a == '*' 
				|| arguments.length == 0 
				|| (a instanceof Array && (b == '??' || arguments.length == 1))){
			var res = {}
			keys = a instanceof Array ? a : keys
			keys
				// add parsed candidates...
				.map(function(k){ return resolvePath(k) })
				// clear keys not in store...
				.filter(function(k){ 
					return dict[k] in storage || k in storage })
				.forEach(function(k){
					res[dict[k] || k] = JSON.parse(storage[k]) })
			return res

		// remove all keys...
		} else if(a === null || (a instanceof Array && b === null)){
			;(a || keys)
				.forEach(function(key){
					delete storage[key] })
			dict = {}

		// expand data to store...
		} else if(typeof(a) != typeof('str')){
			Object.keys(a).forEach(function(key){
				var k = resolvePath(key)
				k != key
					&& (dict[k] = key)
				storage[k] = JSON.stringify(a[key]) })

		// remove key...
		// XXX revise, should this be null or undefined???
		} else if(b === null){
			var k = resolvePath(a)
			delete dict[k]
			delete storage[k]

		// get keys...
		// XXX revise, should this be null or undefined???
		} else if(b === undefined){
			var k = resolvePath(a)
			return k in storage ? 
				JSON.parse(storage[k]) 
				: actions.UNDEFINED

		// write key...
		} else {
			var k = resolvePath(a)
			k != a
				&& (dict[k] = a)
			storage[k] = JSON.stringify(b)
		}

		storage[resolvePath('${INSTANCE}/__dict__')] = JSON.stringify(dict)
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
		'store-instance-key': 'ImageGrid.Viewer.main',
	},

	// NOTE: for docs see __storageHandler_doc...
	localStorageDataHandler: ['- Store/',
		{handle_data_store: 'storage',},
		makeStorageHandler('localStorage')],
	sessionStorageDataHandler: ['- Store/',
		{handle_data_store: 'session',},
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

	handlers: [
		// localStorage...
		// XXX should we use .localStorageDataHandler(..) here???
		// XXX the following two sections are almost identical...
		['saveStore', 
			function(res, query, value){
				var q = this.parseStoreQuery(query)
				query 
					&& q.key instanceof Array
					&& q.store.indexOf('storage') >= 0
					&& q.key.forEach(function(k){
						this.localStorageDataHandler(
							k, 
							res !== this ? res.data : value) }.bind(this)) }],
		['loadStore', 
			function(res, query){
				query = this.parseStoreQuery(query)
				res.storage
					&& Object.assign(res.storage, this.localStorageDataHandler(query.key)) }],
		['clearStore', 
			function(_, query){
				var q = this.parseStoreQuery(query)
				query 
					&& q.store.indexOf('storage') >= 0
					&& this.localStorageDataHandler(q.key, null) }],

		// sessionStorage...
		['saveStore', 
			function(res, query, value){
				var q = this.parseStoreQuery(query)
				query 
					&& q.key instanceof Array
					&& q.store.indexOf('session') >= 0
					&& q.key.forEach(function(k){
						this.sessionStorageDataHandler(
							k, 
							res !== this ? res.data : value) }.bind(this)) }],
		['loadStore', 
			function(res, query){
				query = this.parseStoreQuery(query)
				res.session
					&& Object.assign(res.session, this.sessionStorageDataHandler(query.key)) }],
		['clearStore', 
			function(_, query){
				var q = this.parseStoreQuery(query)
				query 
					&& q.store.indexOf('session') >= 0
					&& this.sessionStorageDataHandler(q.key, null) }],
	],
})



//---------------------------------------------------------------------

// XXX StoreFSJSONSync
// 		Lookup order:
// 			- app dir
// 			- $HOME
var StoreFSJSONActions = actions.Actions({
	config: {
	},

	// XXX
	localStorageFSJSONSyncHandler: ['- Store/',
		{handle_data_store: 'fileSync',},
		function(a, b){
			// XXX
		}],
	// XXX
	localStorageFSJSONHandler: ['- Store/',
		{handle_data_store: 'file',},
		function(a, b){
			// XXX
			return new Promise(function(resolve, reject){
				// XXX
				resolve()
			})
		}],
})

var StoreFSJSON = 
module.StoreFSJSONSync = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'store-fs',
	depends: [
		'fs',
		'store',
	],

	actions: StoreFSJSONActions,
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
