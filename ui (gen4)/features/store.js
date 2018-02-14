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
	// XXX we need to be able to save/load specific part of the data...
	// 		...i.e. query by store and/or key...
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
	config: {
		'store-root-key': 'ImageGrid.Viewer.main',
	},

	// XXX get root key from config...
	// 		...this would require us to store the store config separately...
	localStorageDataHandler: ['- Store/',
		{handle_data_store: 'localStorage',},
		function(data){
			// XXX get this from config...
			var root = this.config['store-root-key'] 

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
			var root = this.config['store-root-key'] 

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


//---------------------------------------------------------------------

// XXX StoreFSJSON




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
