/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

var data = require('imagegrid/data')

var actions = require('lib/actions')
var features = require('lib/features')

var browse = require('lib/widget/browse')

var core = require('features/core')
var widgets = require('features/ui-widgets')



/*********************************************************************/
// XXX should collections be in the Crop menu????

// XXX things we need to do to collections:
// 		- remove images (from collection) ????
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
var CollectionActions = actions.Actions({

	collections: null,

	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },

	loadCollection: ['- Collections/',
		function(collection){
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return
			}

			this.crop(this.collections[collection].data)
		}],
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
			collection = collection || this.collection

			if(collection == null){
				return
			}

			var collections = this.collections = this.collections || {}

			collections[collection] = {
				title: collection,

				// XXX we need to trim .order to only the current images???
				data: empty ? 
					(new this.data.constructor())
					: this.data
						.clone()
						.removeUnloadedGids()
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
			return Object.keys(this.collections || {})
				.filter(function(c){
					return !gid 
						|| that.collections[c].data.order.indexOf(gid) >= 0 })
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
						: [gid] })
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

	/*/ XXX do we actually need this???
	// 		...a way to delete stuff from collections is to crop out 
	// 		and overwrite...
	uncollect: ['- Collections/',
		function(gids, collection){
			// XXX
		}],
	//*/

	removeCollection: ['- Collections/',
		function(collection){
			// XXX
			delete this.collections[collection]
		}],

	// manage serialization and loading...
	// XXX make this reflect the format automatically...
	load: [function(json){
		var collections = {}
		var c = json.collections || {}

		Object.keys(c).forEach(function(title){
				// XXX make this reflect the format automatically...
			collections[title] = {
				title: title,

				data: data.Data.fromJSON(c[title].data)
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
				// XXX make this reflect the format automatically...
				res.collections[title] = {
					title: title,

					data: collections[title].data.dumpJSON()
				}
			})
		}
	} }],
	clear: [function(){
		delete this.collections
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
		// XXX not yet sure if this is the right way to go...
		['loadCollection',
			function(_, collection){
				if(this.collections && collection in this.collections){
					this.data.collection = this.location.collection = collection
				}
			}],
		['uncrop',
			function(){
				var collection = this.location.collection = this.data.collection

				// cleanup...
				if(collection == null){
					delete this.location.collection
				}
			}],
	],
})



//---------------------------------------------------------------------

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
	// XXX add kb handler???
	// XXX this is very similar to .browseCollections(..), is this a problem???
	browseImageCollections: ['Image/Collections...',
		{dialogTitle: 'Image Collections...'},
		widgets.makeUIDialog(function(gid){
			var that = this
			gid = this.data.getImage(gid)

			var to_remove = []

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
						.on('update', function(){
							that.collection
								&& dialog.filter(JSON.stringify(that.collection))
									.addClass('highlighted')
						})

					var all = Object.keys(that.collections || {})
					var collections = that.inCollections(gid || null)

					// build the disabled list...
					all.forEach(function(title){
						collections.indexOf(title) < 0
							&& to_remove.push(title)
					})

					all.length > 0 ?
						make.EditableList(all, 
							{
								new_item: false,
								to_remove: to_remove,
								itemopen: function(title){
									that.loadCollection(title)
									gid
										&& that.focusImage(gid)
									dialog.close()
								},
							})
						: make.Empty()
				})
				.close(function(){
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

	// XXX this is not used by metadata yet...
	metadataSection: ['- Image/',
		function(gid, make){
		}],
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

	handlers: [],
})



//---------------------------------------------------------------------
// XXX Things to try/do:
// 		- save collection on exit/write (?)
// 		- lazy load collections (load list, lazy-load data)
// 		- load directories as collections...
// 		- export collections to directories...
var FileSystemCollection = 
module.FileSystemCollection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'fs-collections',
	depends: [
		'fs',
		'collections',
	],

	handlers: [],
})



//---------------------------------------------------------------------
// XXX localstorage-collections (???)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
