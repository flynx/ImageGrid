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
var CollectionActions = actions.Actions({

	// Format:
	// 	{
	// 		<title>: {
	// 			title: <title>,
	// 			gid: <gid>,
	// 			data: <data>,
	// 			...
	// 		},
	// 		...
	// 	}
	collections: null,

	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },

	// XXX need a way to prevent multiple loads...
	// 		...checking if .collection is set to collection is logical but
	// 		may prevent reloading of collections -- i.e. loading a collection
	// 		anew if it is already loaded...
	// XXX doc the protocol...
	loadCollection: ['- Collections/',
		core.doc`Load collection...

		This will get collection data and crop into it.
			
		If .data for a collection is not available this will do nothing, 
		this enables extending actions to handle the collection in 
		different ways.

		The extending action if compatible must:
			- construct data
			- load data via:
				this.crop(data)
			- when done call:
				this.collectionLoaded(collection)

		XXX would be good to have a way to check if loading was done 
			within this .loadCollection(..) call...
		`,
		function(collection){
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return
			}

			var data = this.collections[collection].data

			data
				&& this.crop(data)
				&& this.collectionLoaded(collection)	
		}],

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
							.crop())
					.run(function(){
						this.collection = collection
					}),
			}
		}],
	newCollection: ['- Collections/',
		function(collection){ return this.saveCollection(collection, true) }],

	inCollections: ['- Image/',
		core.doc`Get list of collections containing item`,
		function(gid){
			var that = this
			gid = this.data.getImage(gid)
			return Object.keys(this.collections || {})
				.filter(function(c){
					return !gid 
						|| that.collections[c].data.getImage(gid) })
						//|| that.collections[c].data.order.indexOf(gid) >= 0 })
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
		`,
		function(align, collection, data){
			collection = arguments.length == 1 ? align : collection
			if(collection == null){
				return
			}
			// if only collection is given, reset align to null...
			align = align === collection ? null : align

			this.collections && this.collections[collection] ?
				this.collections[collection].data.join(align, data || this.data.clone())
				: this.saveCollection(collection)
		}],

	// XXX do we actually need this???
	// 		...a way to delete stuff from collections is to crop out 
	// 		and overwrite...
	// XXX should this reload???
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

			// NOTE: we are not using .data.updateImagePositions(gids, 'hide') 
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

			if(this.collection == collection){
				this.data
					.run(hideGIDs)
					.removeEmptyRibbons()
			}

			this.collections[collection].data
				.run(hideGIDs)
				.removeEmptyRibbons()
		}],

	removeCollection: ['- Collections/',
		function(collection){
			// XXX
			delete this.collections[collection]
		}],

	// manage serialization and loading...
	// XXX make this reflect the format automatically...
	load: [function(json){
		var that = this
		var collections = {}
		var c = json.collections || {}

		Object.keys(c).forEach(function(title){
			var data = data.Data
				.fromJSON(c[title].data)

			// XXX make this reflect the format automatically...
			collections[title] = {
				title: title,

				data: data,
			}
		})

		if(Object.keys(collections).length > 0){
			this.collections = collections
		}
	}],
	json: [function(){ return function(res){
		var collections = this.collections
		if(collections){
			res.collections = {}
			Object.keys(this.collections).forEach(function(title){
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
		this.collectionUnloaded('*')
		delete this.collections
		delete this.location.collection
	}],
})

// XXX manage format...
// XXX manage changes...
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
					collection != this.data.collection
						&& this.collectionUnloaded(collection) }
			}],
		['collectionLoaded',
			function(){
			}],
		['collectionUnloaded',
			function(collection){
				var collection = this.location.collection = this.data.collection

				// cleanup...
				if(collection == null){
					delete this.location.collection
				}
			}],
	],
})



//---------------------------------------------------------------------

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

					var collections = Object.keys(that.collections || {})

					make.EditableList(collections, 
						{
							unique: true,
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

					all = Object.keys(that.collections || {})

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
	saveAsCollection: ['Collections/$Save as collection...',
		widgets.uiDialog(function(){
			return this.browseCollections(function(title){
				this.saveCollection(title) }) })],
	addToCollection: ['Collections|Image/Add $image to collection...',
		widgets.uiDialog(function(gids){
			return this.browseCollections(function(title){
				this.collect(gids || this.current, title) }) })],
	addLoadedToCollection: ['Collections/$Add loaded images to collection...',
		widgets.uiDialog(function(){ return this.addToCollection('loaded') })],
	joinToCollection: ['Collections/$Merge view to collection...',
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
// 		- load directories as collections...
// 		- export collections to directories...

// XXX lazy load collections...
var FileSystemCollectionActions = actions.Actions({

})


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
