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

var browse = require('lib/widget/browse')

var core = require('features/core')
var widgets = require('features/ui-widgets')



/*********************************************************************/
// XXX should collections be in the Crop menu????

// XXX things we need to do to collections:
// 		- add images from current state
// 		- remove images (from collection)
var CollectionActions = actions.Actions({

	collections: null,

	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },


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
	loadCollection: ['- Collections/',
		function(collection){
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return
			}

			this.crop(this.collections[collection].data)

			// XXX need to clear this when exiting crop...
			this.location.collection = collection
		}],
	saveCollection: ['- Collections/Save collection',
		core.doc`Save current state to collection`,
		function(collection){
			collection = collection || this.collection

			if(collection == null){
				return
			}

			var collections = this.collections = this.collections || {}

			collections[collection] = {
				title: collection,

				// XXX we need to trim .order to only the current images???
				data: this.data
					.clone()
					.removeUnloadedGids(),
			}
		}],

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
		core.doc`Add items to collection`,
		function(gids, collection){
			var that = this

			gids = gids instanceof Array ? gids : [gids]
			gids = gids
				.map(function(gid){ 
					return gid in that.data.ribbons ? 
						// when adding a ribbon gid expand to images...
						that.data.ribbons[gid].compact()
						: [gid] })
				.reduce(function(a, b){ return a.concat(b) }, [])

			collection = collection || this.collection

			// XXX add to collection...
			// XXX
		}],
	uncollect: ['- Collections/',
		function(gids, collection){
			// XXX
		}],

	removeCollection: ['- Collections/',
		function(collection){
			// XXX
			delete this.collections[collection]
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

	handlers: [],
})



//---------------------------------------------------------------------

// XXX show collections in image metadata...
var UICollectionActions = actions.Actions({
	// XXX highlight current collections....
	browseCollections: ['Collections|Crop/Collections...',
		widgets.makeUIDialog(function(gid){
			var that = this
			gid = gid != null ? this.data.getImage(gid) : gid

			var to_remove = []

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this

					//var collections = Object.keys(that.collections || {})
					var collections = that.inCollections(gid || null)

					make.EditableList(collections, 
						{
							unique: true,
							to_remove: to_remove,
							itemopen: function(title){
								that.loadCollection(title)
								gid
									&& that.focusImage(gid)
								dialog.close()
							},
							normalize: function(title){ 
								return title.trim() },
							check: function(title){ 
								return title.length > 0 },

							itemadded: function(title){
								that.saveCollection(title) },
						})
				})
				.close(function(){
					to_remove.forEach(function(title){ 
						that.removeCollection(title) 
					}) 
				})
		})],
	// XXX add kb handler???
	// XXX highlight current collections....
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
// XXX
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
