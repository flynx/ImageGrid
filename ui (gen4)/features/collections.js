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

// XXX things we need to do to collections:
// 		- add images from current state
// 		- remove images (from collection)
// 		- check what collections is image in...
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
	// XXX need to .reload() here...
	loadCollection: ['-Collections/',
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
				data: this.data.clone(),
			}
		}],


	inCollections: ['- Image/',
		core.doc`Get list of collections containing item`,
		function(gid){
			var that = this
			return Object.keys(this.collections || {})
				.filter(function(c){
					return that.collections[c].data.order.indexOf(gid) >= 0 })
		}],
	toCollection: ['- Collections/',
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

			console.log('>>>', gids)

			// XXX add to collection...
			// XXX
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

	actions: CollectionActions, 

	handlers: [],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
