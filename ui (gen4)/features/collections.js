/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var data = require('imagegrid/data')

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var browse = require('lib/widget/browse')

var core = require('features/core')
var widgets = require('features/ui-widgets')



/*********************************************************************/
// XXX should collections be in the Crop menu????
// 		...essentially a collection is a saved crop, so this would be 
// 		logical, would simplify control, etc.
// 		

// XXX things we need to do to collections:
// 		- auto-collections
// 			- tags -- adding/removing images adds/removes tags
// 			- ribbons -- top / bottom / n-m / top+2 / ..
// XXX might be a good idea to make collection loading part of the 
// 		.load(..) protocol...
// 		...this could be done via a url suffix, as a shorthand.
// 		something like:
// 			/path/to/index:collection
// 				-> /path/to/index/sub/path/.ImageGrid/collections/collection
// XXX loading collections by direct path would require us to look 
// 		in the containing index for missing parts (*images.json, ...)
// XXX saving a local collection would require us to save to two 
// 		locations:
// 			- collection specific stuff (data) to collection path
// 			- global stuff (images, tags, ...) to base index...
// XXX handle tags here???
// 		...keep them global or local to collection???
// 		global sounds better...
// XXX undo...
var CollectionActions = actions.Actions({
	config: {
		// XXX add default collection list to config...
		'default-collections': [
		],
	},

	// Format:
	// 	{
	// 		<title>: {
	// 			title: <title>,
	// 			gid: <gid>,
	//
	// 			// base collection format -- raw data...
	// 			data: <data>,
	//
	// 			...
	// 		},
	// 		...
	// 	}
	collections: null,


	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },

	get collection_order(){
		if(this.collections == null){
			return null
		}

		var collections = this.collections
		var keys = Object.keys(collections)
		var order = this.__collection_order = this.__collection_order || []

		// add unsorted things to the head of the list...
		var res = keys
			.concat(order)
			.reverse()
			.unique()
			.reverse()

		// remove stuff not present...
		if(res.length > keys.length){
			res = res.filter(function(e){ return e in collections })
		}

		this.__collection_order.splice.apply(this.__collection_order, 
			[0, this.__collection_order.length].concat(res))

		return this.__collection_order
	},
	set collection_order(value){
		this.__collection_order = value },

	// Format:
	// 	{
	// 		// NOTE: this is always the first handler...
	// 		'data': <action-name>,
	//
	// 		<format>: <action-name>,
	// 		...
	// 	}
	get collection_handlers(){
		var handlers = this.__collection_handlers || {}

		if(Object.keys(handlers).length == 0){
			var that = this
			handlers['data'] = null
			this.actions.forEach(function(action){
				var fmt = that.getActionAttr(action, 'collectionFormat')
				if(fmt){
					handlers[fmt] = action
				}
			})
		}

		return handlers
	},

	collectionDataLoader: ['- Collections/',
		core.doc`Collection data loader
		
			.collectionDataLoader(title, data)
				-> promise
		
		The resulting promise will resolve to a Data object that will get
		loaded as the collection.

		data is of the .collections item format.
		`,
		{collectionFormat: 'data'},
		function(title, data){ 
			return new Promise(function(resolve){ resolve(data.data) }) }],

	loadCollection: ['- Collections/',
		core.doc`Load collection...

		This will get collection data and crop into it.
			
		If .data for a collection is not available this will do nothing, 
		this enables extending actions to handle the collection in 
		different ways.

		Protocol:
		- collection format handlers: .collection_handlers
			- built from actions that define .collectionFormat attr to 
			  contain the target format string.
		- format is determined by matching it to a key in .collections[collection]
			e.g. 'data' is applicable if .collections[collection].data is not null
		- the format key's value is passed to the handler action
		- the handler is expected to return a promise
		- only the first matching handler is called
		- the data handler is always first to get checked

		For an example handler see:
			.collectionDataLoader(..)


		The .data handler is always first to enable caching, i.e. once some
		non-data handler is done, it can set the .data which will be loaded
		directly the next time.
		To invalidate such a cache .data should simply be deleted.
		`,
		function(collection){
			var that = this
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return
			}

			var data = this.collections[collection]
			var handlers = this.collection_handlers

			// XXX might be good to sort handlers...
			// XXX

			for(var format in handlers){
				if(data[format]){
					return this[handlers[format]](collection, data)
						.then(function(data){
							data
								&& that.crop.chainCall(that, function(){
									// NOTE: the collection and .data may have different
									// 		orders and/or sets of elements, this we need 
									// 		to sync, and do it BEFORE all the rendering 
									// 		happens...
									that.data.updateImagePositions()
								}, data)
								// NOTE: we need this to sync the possible different 
								// 		states (order, ...) of the collection and .data...
								&& that.collectionLoaded(collection)	
						})
				}
			}
		}],

	// events...
	collectionLoaded: ['- Collections/',
		core.doc`This is called by .loadCollection(..) or one of the 
		overloading actions when collection load is done...
		
		`,
		core.notUserCallable(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
			this.data.collection = this.location.collection = collection
		})],
	collectionUnloaded: ['- Collections/',
		core.doc`This is called when unloading a collection.
		`,
		core.notUserCallable(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],

	saveCollection: ['- Collections/',
		core.doc`Save current state to collection

			Save Current state as collection
			.saveCollection(collection)
				-> this

			Save new empty collection
			.saveCollection(collection, true)
				-> this
		`,
		function(collection, empty){
			var that = this
			collection = collection || this.collection

			if(collection == null){
				return
			}

			var collections = this.collections = this.collections || {}

			collections[collection] = {
				title: collection,

				// NOTE: we do not need to care about tags here as they 
				// 		will get overwritten on load...
				data: (empty ? 
						(new this.data.constructor())
						: this.data
							.clone()
							.removeUnloadedGIDs())
					.run(function(){
						this.collection = collection
						// NOTE: we are doing this manually after .removeUnloadedGIDs(..)
						// 		as the later will mess-up the structures 
						// 		inherited from the main .data, namely tags...
						this.tags = that.data.tags
					}),
			}
		}],
	newCollection: ['- Collections/',
		function(collection){ return this.saveCollection(collection, true) }],
	// XXX should we do anything special if collection is loaded???
	removeCollection: ['- Collections/',
		function(collection){
			delete this.collections[collection]
		}],

	inCollections: ['- Image/',
		core.doc`Get list of collections containing item`,
		function(gid){
			var that = this
			gid = this.data.getImage(gid)
			//return Object.keys(this.collections || {})
			return this.collection_order
				.filter(function(c){
					return !gid 
						|| that.collections[c].data.getImage(gid) })
		}],

	collect: ['- Collections/',
		core.doc`Add items to collection

		NOTE: this will not account for item topology.`,
		function(gids, collection){
			var that = this

			gids = gids == 'loaded' ? this.data.getImages('loaded')
				: gids instanceof Array ? gids 
				: [gids]
			gids = gids
				.map(function(gid){ 
					return gid in that.data.ribbons ? 
						// when adding a ribbon gid expand to images...
						that.data.ribbons[gid].compact()
						: [that.data.getImage(gid)] })
				.reduce(function(a, b){ return a.concat(b) }, [])

			collection = collection || this.collection

			if(collection == null){
				return
			}

			// add to collection...
			var data = this.data.constructor.fromArray(gids)

			return this.joinCollect(null, collection, data)
		}],
	joinCollect: ['- Collections/Merge to collection',
		core.doc`Merge/Join current state to collection

			Join current state into collection
			.joinCollect(collection)
				-> this

			Join current state with specific alignment into collection
			.joinCollect(align, collection)
				-> this

			Join data to collection with specific alignment
			.joinCollect(align, collection, data)
				-> this

		This is like .collect(..) but will preserve topology.
		
		NOTE: for align docs see Data.join(..)
		NOTE: if align is set to null or not given then it will be set 
			to default value.
		NOTE: this will join to the left (prepend) of the collections, this is 
			different from how basic .join(..) works (appends)
		`,
		function(align, collection, data){
			collection = arguments.length == 1 ? align : collection
			if(collection == null){
				return
			}
			// if only collection is given, reset align to null...
			align = align === collection ? null : align

			if(this.collections && this.collections[collection]){
				//this.collections[collection].data.join(align, data || this.data.clone())
				this.collections[collection].data = (data || this.data)
					.clone()
					.join(align, this.collections[collection].data)

			} else {
				this.saveCollection(collection)
			}
		}],
	uncollect: ['Collections|Image/$Uncollect image',
		{browseMode: function(){ return !this.collection && 'disabled' }},
		function(gids, collection){
			var that = this

			gids = gids == 'loaded' ? this.data.getImages('loaded')
				: gids instanceof Array ? gids 
				: [gids]
			gids = gids
				.map(function(gid){ 
					return gid in that.data.ribbons ? 
						// when adding a ribbon gid expand to images...
						that.data.ribbons[gid].compact()
						: [that.data.getImage(gid)] })
				.reduce(function(a, b){ return a.concat(b) }, [])

			collection = collection || this.collection

			if(collection == null){
				return
			}

			/*/ NOTE: we are not using .data.updateImagePositions(gids, 'hide') 
			// 		here because it will remove the gids from everything
			// 		while we need them removed only from ribbons...
			var hideGIDs = function(){
				var d = this
				gids.forEach(function(gid){
					var i = d.order.indexOf(gid)
					Object.keys(d.ribbons).forEach(function(r){
						delete d.ribbons[r][i]
					})
				})
			}
			//*/

			if(this.collection == collection){
				this.data
					//.run(hideGIDs)
					.removeGIDs(gids)
					.removeEmptyRibbons()
			}

			this.collections[collection].data
				//.run(hideGIDs)
				.removeGIDs(gids)
				.removeEmptyRibbons()
		}],

	// manage serialization and loading...
	// XXX make this reflect the format automatically...
	load: [function(json){
		var that = this
		var collections = {}
		var c = json.collections || {}
		var order = json.collection_order || Object.keys(c)
			
		Object.keys(c).forEach(function(title){
			var d = data.Data
				.fromJSON(c[title].data)

			// XXX make this reflect the format automatically...
			collections[title] = {
				title: title,

				data: d,
			}
		})

		return function(){
			if(Object.keys(collections).length > 0){
				this.collection_order = order
				this.collections = collections
			}
		}
	}],
	// NOTE: we do not store .collection_order here, because we order 
	// 		the collections in the object.
	// 		...when saving a partial collection set, for example in
	// 		.prepareIndexForWrite(..) it would be necessary to add it 
	// 		in to maintain the correct order when merging... (XXX)
	// XXX make this reflect the format automatically...
	json: [function(){ return function(res){
		var collections = this.collections

		if(collections){
			var order = this.collection_order

			res.collections = {}
			order.forEach(function(title){
				var data = collections[title].data.dumpJSON()
				delete data.tags

				// XXX make this reflect the format automatically...
				res.collections[title] = {
					title: title,

					data: data, 
				}
			})
		}
	} }],
	clear: [function(){
		this.collection
			&& this.collectionUnloaded('*')
		delete this.collections
		delete this.__collection_order
		delete this.location.collection
	}],
})


var Collection = 
module.Collection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'collections',
	depends: [
		'base',
		'crop',
	],
	suggested: [
		'ui-collections',
		'fs-collections',
	],

	actions: CollectionActions, 

	handlers: [
		// maintain the .collection state...
		['uncrop.pre',
			function(){
				var collection = this.collection
				return function(){
					collection != null 
						&& collection != this.data.collection
						&& this.collectionUnloaded(collection) }
			}],
		['collectionLoaded',
			function(){
				console.log('COLLECTION: LOADED')
			}],
		['collectionUnloaded',
			function(_, collection){
				var collection = this.location.collection = this.data.collection

				// cleanup...
				if(collection == null){
					delete this.location.collection
				}

				console.log('COLLECTION: UNLOADED')

				this.data.updateImagePositions()
			}],
	],
})



//---------------------------------------------------------------------

// XXX make collections sortable...
// XXX do we need a collection button (like crop button?) ???
// XXX show collections in image metadata...
var UICollectionActions = actions.Actions({
	browseCollections: ['Collections|Crop/$Collec$tions...',
		widgets.makeUIDialog(function(action){
			var that = this
			var to_remove = []

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
						.on('update', function(){
							that.collection
								&& dialog.filter(JSON.stringify(that.collection))
									.addClass('highlighted')
						})

					//var collections = Object.keys(that.collections || {})
					var collections = that.collection_order = that.collection_order || []

					make.EditableList(collections, 
						{
							unique: true,
							sortable: 'y',
							to_remove: to_remove,
							itemopen: function(title){
								var gid = that.current
								action ?
									action.call(that, title)
									: that.loadCollection(title)
								that.focusImage(gid)
								dialog.close()
							},
							normalize: function(title){ 
								return title.trim() },
							check: function(title){ 
								return title.length > 0 },

							// XXX should this be "on close"???
							itemadded: function(title){
								action ?
									that.newCollection(title)
									: that.saveCollection(title) },
						})
				}, {
					// focus current collection...
					selected: that.collection,
				})
				.close(function(){
					to_remove.forEach(function(title){ 
						that.removeCollection(title) 
					}) 
				})
		})],
	browseImageCollections: ['Image/$Collections...',
		{dialogTitle: 'Image Collections...'},
		widgets.makeUIDialog(function(gid){
			var that = this
			gid = this.data.getImage(gid)

			var all
			var collections

			var to_remove

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
						.on('update', function(){
							that.collection
								&& dialog.filter(JSON.stringify(that.collection))
									.addClass('highlighted')
						})

					//all = Object.keys(that.collections || {})
					all = that.collection_order = that.collection_order || []

					collections = collections 
						|| that.inCollections(gid || null)

					// build the disabled list...
					if(!to_remove){
						to_remove = []
						all.forEach(function(title){
							collections.indexOf(title) < 0
								&& to_remove.push(title)
						})
					}

					all.length > 0 ?
						make.EditableList(all, 
							{
								new_item: false,
								to_remove: to_remove,
								itemopen: function(title){
									var i = to_remove.indexOf(title)

									i >= 0 ? 
										to_remove.splice(i, 1) 
										: to_remove.push(title)

									dialog.update()
								},
							})
						: make.Empty()
				})
				.close(function(){
					all.forEach(function(title){
						collections.indexOf(title) < 0
							&& to_remove.indexOf(title) < 0
							&& that.collect(gid, title)
					})
					to_remove.forEach(function(title){ 
						that.uncollect(gid, title)
					}) 
				})
		})],

	// Collections actions with collection selection...
	// XXX should we warn the user when overwriting???
	saveAsCollection: ['Collections|Crop/$Save as collection...',
		widgets.uiDialog(function(){
			return this.browseCollections(function(title){
				this.saveCollection(title) }) })],
	addToCollection: ['Collections|Crop|Image/Add $image to collection...',
		widgets.uiDialog(function(gids){
			return this.browseCollections(function(title){
				this.collect(gids || this.current, title) }) })],
	addLoadedToCollection: ['Collections|Crop/$Add loaded images to collection...',
		widgets.uiDialog(function(){ return this.addToCollection('loaded') })],
	joinToCollection: ['Collections|Crop/$Merge view to collection...',
		widgets.uiDialog(function(){
			return this.browseCollections(function(title){
				this.joinCollect(title) }) })],

	/*/ XXX this is not used by metadata yet...
	metadataSection: ['- Image/',
		function(gid, make){
		}],
	//*/
})


var UICollection = 
module.UICollection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-collections',
	depends: [
		'ui',
		'collections',
	],

	actions: UICollectionActions, 

	handlers: [
		['uncollect',
			function(_, gids, collection){
				(collection == null || this.collection == collection)
					&& this.reload(true)
			}],
	],
})



//---------------------------------------------------------------------
// XXX Things to try/do:
// 		- save collection on exit/write (?)
// 		- lazy load collections (load list, lazy-load data)
// 			- collection index
// 		- load directories as collections (auto?)...
// 		- export collections to directories...
// 		- auto-export collections (on save)...
// 			- add new images
// 			- remove old images...
// 		- collection history (same as ctrl-shift-h)...

var FileSystemCollectionActions = actions.Actions({

	// Format:
	// 	{
	// 		path: <string>,
	// 		...
	// 	}
	collections: null,

	collectionPathLoader: ['- Collections/',
		{collectionFormat: 'path'},
		function(data, loader){ 
			// XXX
		}],

	importCollectionsFromPath: ['- Collections|File/Import collections from path',
		function(path){
			// XXX
		}],
})


// XXX manage format...
// XXX manage changes...
var FileSystemCollection = 
module.FileSystemCollection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-collections',
	depends: [
		'index-format',
		'fs',
		'collections',
	],

	actions: FileSystemCollectionActions,

	handlers: [
		// XXX maintain changes...
		// XXX
		[[
			'collect',
			'joinCollect',
			'uncollect',

			'saveCollection',

			'removeCollection',
		], 
			function(){
				// XXX mark changed collections...
				// XXX added/removed collection -> mark collection index as changed...
			}],

		// XXX handle removed collections -- move to trash (???)
		// 		...might be a good idea to add something like index gc API...
		['prepareIndexForWrite',
			function(res, _, full){
				var changed = full == true 
					|| res.changes === true
					|| res.changes.collections

				if(changed && res.raw.collections){
					// select the actual changed collection list...
					changed = changed === true ? 
						Object.keys(res.raw.collections)
						: changed

					// collection index...
					res.index['collection-index'] = Object.keys(this.collections)

					Object.keys(changed)
						// skip the raw field...
						.filter(function(k){ return changed.indexOf(k) >= 0 })
						.forEach(function(k){
							// XXX use collection gid...
							res.index['collections/' + k] = res.raw.collections[k]
						})
				}
			}],
		['prepareJSONForLoad',
			function(res, json){
				// XXX
			}],
	],
})



//---------------------------------------------------------------------
// XXX localstorage-collections (???)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
