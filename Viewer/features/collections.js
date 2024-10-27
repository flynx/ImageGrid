/**********************************************************************
* 
*
*
**********************************************************************/
((typeof define)[0]=='u'?function(f){module.exports=f(require)}:define)
(function(require){ var module={} // make module AMD/node compatible...
/*********************************************************************/

if(typeof(process) != 'undefined'){
	var fse = requirejs('fs-extra')
	var pathlib = requirejs('path')
	var file = require('imagegrid/file')
}

var util = require('lib/util')

var data = require('imagegrid/data')

var toggler = require('lib/toggler')
var actions = require('lib/actions')
var features = require('lib/features')

var browse = require('lib/widget/browse')

var core = require('features/core')
var widgets = require('features/ui-widgets')



/*********************************************************************/
// 
// XXX need a way to load a collection directly...
// 		- reload from .location.collection
// 		- path syntax 
// 			<path>:<title-selector>	-- needs to be normalized
// 			<path>:<gid>
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
// XXX local tags:
// 		- save		- done
// 		- load		- done
// 		- save/merge use...
// XXX merge data -- collection/crop/all
// 		- vertical only
// 		- horizontal only
// 		- both
// XXX external / linked collections (.location)...
// XXX merge collections from multiple indexes -- can we avoid extending the format???
//

// XXX should these be in .config???
var MAIN_COLLECTION_TITLE =
module.MAIN_COLLECTION_TITLE = '$ALL'

var MAIN_COLLECTION_GID =
module.MAIN_COLLECTION_GID = '0'

var COLLECTION_TRANSFER_CHANGES =
module.COLLECTION_TRANSFER_CHANGES = [
	'metadata',
	'data',
]



//---------------------------------------------------------------------

// XXX add undo...
var CollectionActions = actions.Actions({
	config: {
		// can be:
		// 	'all'		- save crop state for all collections (default)
		// 	'main'		- save crop state for main state only
		// 	'none'		- do not save crop state
		'collection-save-crop-state': 'all',


		// XXX should this be in config???
		// 		...technically no, but we need this to resolve correctly 
		// 		to a relevant feature...
		'collection-transfer-changes': COLLECTION_TRANSFER_CHANGES.slice(),

		// Global default collections...
		//
		// NOTE: delete or set to null for none...
		//'default-collections': null,
	},

	// Format:
	// 	{
	// 		<title>: {
	// 			title: <title>,
	// 			gid: <gid>,
	// 			count: <number>,
	//
	// 			crop_stack: [ .. ],
	//
	// 			// base collection format -- raw data...
	// 			data: <data>,
	//
	// 			...
	// 		},
	// 		...
	// 	}
	collections: null,

	get collectionGIDs(){
		var res = {}
		var c = this.collections || {}
		Object.keys(c)
			.forEach(function(title){
				res[c[title].gid || title] = title })
		return res },

	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },
	get collectionGID(){
		return ((this.collections || {})[this.collection] || {}).gid 
			|| MAIN_COLLECTION_GID },
	set collectionGID(value){
		this.collection = value },

	// XXX should this check consistency???
	get collection_order(){
		var collections = this.collections
		var defaults = this.config['default-collections'] || []

		// no collections -> return defaults | []
		if(this.collections == null){
			return defaults.slice() }

		var keys = Object.keys(collections)
		var order = this.__collection_order = this.__collection_order || []

		// add unsorted things to the head of the list...
		var res = [
			...keys,
			...order,
		].tailUnique()

		// defaults...
		res = res.concat(defaults).unique()

		// keep MAIN_COLLECTION_TITLE out of the collection order...
		var m = res.indexOf(MAIN_COLLECTION_TITLE)
		m >= 0
			&& res.splice(m, 1)

		// remove stuff not present...
		if(res.length > keys.length){
			res = res.filter(function(e){ 
				return e in collections 
					|| defaults.indexOf(e) >= 0 }) }

		this.__collection_order.splice(0, this.__collection_order.length, ...res)

		return this.__collection_order.slice() },
	set collection_order(value){
		value 
			&& this.sortCollections(value) },

	// NOTE: this accounts only for actual collections and does not counts
	// 		MAIN_COLLECTION_TITLE that can be contained in .collections,
	// 		thus this is NOT the same as:
	// 			Object.keys(this.collections).length
	// XXX do we need this???
	get collections_length(){
		var c = (this.collections || {})
		return MAIN_COLLECTION_TITLE in c ? 
			Object.keys(c).length - 1
			: Object.keys(c).length },

	// Format:
	// 	{
	// 		// NOTE: this is always the first handler...
	// 		'data': <action-name>,
	// 		'gid': <gid>,
	//
	// 		<format>: <action-name>,
	// 		...
	// 	}
	//
	// XXX revise doc...
	// XXX this is almost the same as .store_handlers...
	get collection_handlers(){
		return this.cache('collection_handlers', function(handlers){
			// cached value...
			if(handlers){
				return Object.assign({}, handlers) }

			var that = this
			handlers = {}

			handlers['data'] = null
			this.actions.forEach(function(action){
				var fmt = that.getActionAttr(action, 'collectionFormat')
				handlers[fmt]
					&& console.warn('Multiple handlers for collection format:', store)
				if(fmt){
					handlers[fmt] = action } })

			// cleanup...
			if(handlers['data'] == null){
				delete handlers['data'] }

			return handlers }) },


	// Collection events...
	//
	collectionLoading: ['- Collections/',
		core.doc`This is called by .loadCollection(..) or one of the 
		overloading actions around the collection load...

		The .pre phase is called just before the load and the .post phase 
		just after.
		
		`,
		core.Event(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],
	collectionUnloaded: ['- Collections/',
		core.doc`This is called when unloading a collection.
		`,
		core.Event(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],
	collectionCreated: ['- Collections/',
		core.doc`This is called when a collection is created.

		NOTE: this is not triggered for the "${MAIN_COLLECTION_TITLE}" collection...
		`,
		core.Event(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],
	collectionRemoved: ['- Collections/',
		core.doc`This is called when a collection is removed.

		NOTE: this is not triggered for the "${MAIN_COLLECTION_TITLE}" collection...
		`,
		core.Event(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],


	// XXX should there be a force arg when we can't actually stop the 
	// 		running promise and recover???
	// XXX need to figure out error handling for this scheme...
	// XXX do we need timeouts here????
	ensureCollection: ['- Collections/',
		core.doc`Ensure a collection exists and is consistent...

			Ensure collection exists and is initialized...
			.ensureCollection(title)
				-> promise(collection)
				NOTE: this will not start a new check until the previous
					is done (i.e. the previous promise is resolved/rejected)

		
		This will:
			- create a collection if it does not exist
			- initialize if needed

		While the promise for a specific action is not resolved this 
		will return it and not start a new promise thus queuing all 
		subsequent calls.
		`,
		function(collection){
			var that = this
			collection = collection 
				|| MAIN_COLLECTION_TITLE

			// main collection shorthand...
			// XXX revise...
			if(this.collection == null 
					&& collection == MAIN_COLLECTION_TITLE){
				return Promise.resolve(this) }

			var running = this.__running_collection_ensure = 
				this.__running_collection_ensure || {}

			// create collection if needed...
			;(!this.collections 
					|| !(collection in this.collections))
				&& this.newCollection(collection)

			var collection_data = this.collections[collection]
			var handlers = this.collection_handlers

			// if a promise has not yet resolved/rejected, return it 
			// and do not start a new one...
			if(running[collection]){
				return running[collection] }

			// handle collection...
			return (running[collection] = new Promise(function(resolve, reject){
				// NOTE: we do not need to return this as we'll resolve/reject
				// 		manually in .then(..) / .catch(..)
				Promise
					.all(Object.keys(handlers)
						// filter relevant handlers...
						.filter(function(format){ 
							return format == '*' || collection_data[format] })
						// run handlers...
						.map(function(format){
							return that[handlers[format]](collection, collection_data) }))
					.then(function(){
						delete running[collection]
						resolve(collection_data) })
					.catch(function(err){
						delete running[collection]
						reject(err) }) })) }],


	// Collection life-cycle...
	//
	// NOTE: if collection does not exist this will do nothing...
	// NOTE: this is not sync, if it is needed to trigger post collection
	// 		loading then bind to collectionLoading.post...
	loadCollection: ['- Collections/',
		core.doc`Load collection...

			Load collection...
			.loadCollection(collection)
			.loadCollection(gid)
				-> this
			
			Force reload current collection...
			.loadCollection('!')
				-> this
				NOTE: this will not call .saveCollection(..) before 
					reloading, thus potentially losing some state that 
					was not explicitly saved.


		When loading a collection, previous state is saved.

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

		Example loader action:
			collectionXLoader: [
				// handle .x
				{collectionFormat: 'x'}
				function(title, state){
					return new Promise(function(resolve){ 
						var x = state.x
		
						// do stuff with .x
		
						resolve() 
					}) }],


		The .data handler is always first to enable caching, i.e. once some
		non-data handler is done, it can set the .data which will be loaded
		directly the next time.
		To invalidate such a cache .data should simply be deleted.


		NOTE: cached collection state is persistent.
		NOTE: when current collection is removed from .collections this 
			will not save state when loading another collection...
		`,
		function(collection){
			var that = this
			var force = collection == '!'
			collection = collection == '!' ? 
				this.collection 
				: collection
			// if collection is a gid, get the title...
			collection = this.collectionGIDs[collection] || collection 
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return }
			var crop_mode = this.config['collection-save-crop-state'] || 'all'

			var current = this.current
			var ribbon = this.current_ribbon

			var prev = this.collection
			var collection_data = this.collections[collection]
			//var handlers = this.collection_handlers

			// save current collection state...
			//
			// main view...
			// NOTE: we save here unconditionally because MAIN_COLLECTION_TITLE
			// 		is stored ONLY when we load some other collection...
			if(this.collection == null){
				this.saveCollection(
					MAIN_COLLECTION_TITLE, 
					crop_mode == 'none' ?  'base' : 'crop', 
					true)

			// collection...
			// NOTE: we only save if the current collection exists, it 
			// 		may not exist if it was just removed...
			} else if(this.collection in this.collections
					// prevent saving over changed current state...
					&& !force){
				this.saveCollection(
					this.collection, 
					crop_mode == 'all' ? 'crop': null) }

			// load collection...
			// XXX should this be sync???
			//return this.ensureCollection(collection)
			this.ensureCollection(collection)
				.then(function(){
					var data = collection_data.data

					if(!data){
						return }

					// current...
					data.current = data.getImage(current) 
						// current is not in collection -> try and keep 
						// the ribbon context...
						|| that.data.getImage(
							current, 
							data.getImages(that.data.getImages(ribbon)))
						// get closest image from collection...
						|| that.data.getImage(current, data.order)
						|| data.current

					that
						.collectionLoading.chainCall(that, 
							function(){
								// do the actual load...
								that.load.chainCall(that, 
									function(){
										that.collectionUnloaded(
											prev || MAIN_COLLECTION_TITLE) }, 
									{
										location: that.location,

										data: data,

										crop_stack: collection_data.crop_stack
											&& collection_data.crop_stack.slice(),

										// NOTE: we do not need to pass collections 
										// 		and order here as they stay in from 
										// 		the last .load(..) in merge mode...
										//collections: that.collections,
										//collection_order: that.collection_order,
									}, true)

								// maintain the .collection state...
								if(collection == MAIN_COLLECTION_TITLE){
									// no need to maintain the main data in two 
									// locations...
									delete that.collections[MAIN_COLLECTION_TITLE]
									delete this.location.collection
								} else {
									that.data.collection = 
										that.location.collection = 
										collection
									// cleanup...
									if(collection == null){
										delete this.location.collection } } }, 
							collection) }) }],
	// XXX should this call .loadCollection('!') when saving to current
	// 		collection???
	// 		This would reaload the view to a consistent (just saved) 
	// 		state...
	// 		...see comments inside...
	// XXX it feels like we need two levels of actions, low-level that 
	// 		just do their job and user actions that take care of 
	// 		consistent state and the like...
	saveCollection: ['- Collections/',
		core.doc`Save current state to collection

			Save current state to current collection
			.saveCollection()
			.saveCollection('current')
				-> this
				NOTE: this will do nothing if no collection is loaded.

			Save state as collection...
			.saveCollection(collection)
				-> this
				NOTE: if saving to self the default mode is 'crop' else
					it is 'current' (see below for info on respective 
					modes)...

			Save current state as collection ignoring crop stack
			.saveCollection(collection, 0)
			.saveCollection(collection, 'current')
				-> this

			Save new empty collection
			.saveCollection(collection, 'empty')
				-> this

			Save current crop state to collection
			.saveCollection(collection, 'crop')
				-> this

			Save top depth crops from current crop stack to collection
			.saveCollection(collection, depth)
				-> this

			Save base crop state to collection
			.saveCollection(collection, 'base')
				-> this


		NOTE: this will overwrite collection .data and .crop_stack only, 
			the rest of the data is untouched...
		NOTE: when saving to current collection and maintain consistent 
			state it may be necessary to .loadCollection('!')
		`,
		function(collection, mode, force){
			var that = this
			collection = collection || this.collection
			collection = collection == 'current' ? this.collection : collection

			if(!force 
					&& (collection == null 
						|| collection == MAIN_COLLECTION_TITLE)){
				return }

			var collections = this.collections = this.collections || {}
			var depth = typeof(mode) == typeof(123) ? mode : null
			mode = depth == 0 ? 'current' 
				: depth ? 'crop' 
				: mode
			// default mode -- if saving to self then 'crop' else 'current'
			if(!mode){
				mode = ((collection in collections 
							&& collection == this.collection) 
						|| collection == MAIN_COLLECTION_TITLE) ? 
					'crop' 
					: 'current' }
			var new_collection = 
				!collections[collection] 
					&& collection != MAIN_COLLECTION_TITLE

			// save the data...
			// XXX would be nice to be able to add new collections both 
			// 		to the start and end of list...
			var state = collections[collection] = 
				collections[collection] 
				|| {}
			state.title = state.title 
				|| collection
			state.gid = state.gid 
				// maintain the GID of MAIN_COLLECTION_TITLE as MAIN_COLLECTION_GID...
				|| (collection == MAIN_COLLECTION_TITLE ? 
					MAIN_COLLECTION_GID 
					// generate unique gid...
					: (function(){
						var gids = that.collectionGIDs
						do{
							var gid = that.data.newGID()
						} while(gids[gid] != null)
						return gid })())
			// NOTE: we do not need to care about tags here as they 
			// 		will get overwritten on load...
			state.data = (mode == 'empty' ? 
					(new this.data.constructor())
				: mode == 'base' && this.crop_stack ? 
					(this.crop_stack[0] || this.data.clone())
				: mode == 'crop' ? 
					this.data.clone()
				// current...
				: this.data.clone()
					.run(function(){
						var d = this
						this.collection = collection })
					.clear('unloaded'))

			// crop mode -> handle crop stack...
			if(mode == 'crop' && this.crop_stack && depth != 0){
				depth = depth || this.crop_stack.length
				depth = this.crop_stack.length - Math.min(depth, this.crop_stack.length)

				state.crop_stack = this.crop_stack.slice(depth)

			// other modes...
			} else {
				delete state.crop_stack }

			// XXX this leads to recursion????
			// 		.loadCollection('X')
			// 			-> .saveCollection('current')
			// 				-> .loadCollection('!')
			// XXX should we be doing this here or on case by case basis externally...
			//collection == this.collection
			//	&& this.loadCollection('!')

			new_collection
				&& this.collectionCreated(collection) }],
	newCollection: ['- Collections/',
		core.doc` Shorthand to .saveCollection(collection, 'empty')`,
		function(collection){ return this.saveCollection(collection, 'empty') }],
	removeCollection: ['- Collections/',
		core.doc`

			.removeCollection(collection)
			.removeCollection(gid)
				-> this
		
		NOTE: when removing the currently loaded collection this will 
			just remove it from .collections and do nothing...`,
		function(collection){
			if(!this.collections || collection == MAIN_COLLECTION_TITLE){
				return }
			collection = this.collectionGIDs[collection] || collection
			if(collection in this.collections){
				delete this.collections[collection]
				this.collectionRemoved(collection) } }],
	renameCollection: ['- Collections/',
		function(from, to){
			if(to == from 
					|| from == MAIN_COLLECTION_TITLE 
					|| to == MAIN_COLLECTION_TITLE 
					|| (this.collections 
						|| {})[from] == null){
				return }

			var order = this.collection_order
			order.splice(order.indexOf(from), 1, to)

			var data = this.collections[to] = this.collections[from]
			delete this.collections[from]

			data.title = to

			if(this.collection == from){
				this.location.collection = to } }],


	// Collection list manipulation...
	//
	sortCollections: ['- Collections/',
		core.doc`Sort collection list...

			Sort collections...
			.sortCollections()	
				NOTE: this is equivalent to [].sort()
				-> this

			Sort collections via cmp function...
			.sortCollections(cmp)	
				NOTE: this is equivalent to [].sort(cmp)
				-> this

			Sort collections via list...
			.sortCollections([item, ...])	
				-> this

		`,
		function(cmp){
			// XXX handle the case when there's no .__collection_order
			if(!this.__collection_order){
				return }
			// sort via list...
			if(cmp instanceof Array){
				this.__collection_order = cmp.slice()
			// cmp...
			} else if(cmp instanceof Function){
				this.__collection_order.sort(cmp)
			// basic sort...
			} else {
				this.__collection_order.sort() }
			this.collection_order }],
	collectionToTop: ['Collections/Bring collection to $top',
		core.doc`Bring collection to top...

			Bring current collection to top of collection list
			.collectionToTop()
				-> this

			Bring collection title to top of collection list
			.collectionToTop(title)
				-> this

			Bring collection gid to top of collection list
			.collectionToTop(gid)
				-> this
		`,
		{mode: 'uncollect'},
		function(collection){
			collection = collection || this.collection
			collection = this.collectionGIDs[collection] || collection
			var o = this.collection_order 

			if(!collection || o.indexOf(collection) < 0){
				return }

			this.collection_order = [collection].concat(o).unique() }],
	

	// Introspection...
	//
	// XXX make this check offline collections -- use .ensureCollection(..)???
	inCollections: ['- Image/',
		core.doc`Get list of collections containing item
		
		NOTE: this currently does not load or check offline collections.
		`,
		function(gid, collections){
			var that = this
			gid = this.data.getImage(gid)
			collections = collections || this.collection_order
			collections = collections instanceof Array ? collections : [collections]
			return collections
				.filter(function(c){
					return c != MAIN_COLLECTION_TITLE
						&& that.collections[c]
						&& that.collections[c].data
						&& (!gid 
							|| that.collections[c].data.getImage(gid)) }) }],


	// Collection editing....
	//
	// NOTE: Currently these are sync, and sequencing collections 
	// 		operations happens automatically as everything uses 
	// 		.ensureCollection(..) internally...
	// 		to explecitly sequence code do:
	//			.collect(..)
	//			.ensureCollection(..)
	//				.then(function(){
	//					// this is run strictly after .collect(..) 
	//					...
	//				})
	// NOTE: see .ensureCollection(..) for more details...
	//
	// XXX undo: need to be able to place collected stuff...
	collect: ['Collections|Image/Add $image to collection...',
		core.doc`Add items to collection

			Add current image to collection...
			.collect('current', collection)
				-> this

			Add current ribbon to collection...
			.collect('ribbon', collection)
				-> this

			Add loaded images to collection...
			.collect('loaded', collection)
				-> this

			
			Add gid(s) to collection...
			.collect(gid, collection)
			.collect([gid, ,. ], collection)
				-> this


		NOTE: this will not account for item topology. To merge accounting
			for topology use .joinCollect(..)
		NOTE: if an image gid is not found locally it will be searched in
			base data...
		`,
		function(gids, collection){
			var that = this
			collection = collection || this.collection
			collection = this.collectionGIDs[collection] || collection 
			if(collection == null || collection == MAIN_COLLECTION_TITLE){
				return }

			gids = gids == 'loaded' ? 
					this.data.getImages('loaded')
				: gids == 'ribbon' ?
					[this.current_ribbon]
				: gids instanceof Array ? 
					gids 
				: [gids]
			gids = gids
				.map(function(gid){ 
					return gid in that.data.ribbons ? 
						// when adding a ribbon gid expand to images...
						that.data.ribbons[gid].compact()
						: [ that.data.getImage(gid) 
							// check base data for image gid...
							|| that.collections[MAIN_COLLECTION_TITLE].data.getImage(gid) ] })
				.flat()

			this.ensureCollection(collection)
				.then((function(c){
					var remove = c.data.getImages(gids, 'all')
					// only add gids that do not exist in collection...
					gids = gids
						.filter(function(g){ 
							return remove.indexOf(g) < 0 })

					if(gids.length == 0){
						return }

					// add to collection...
					var data = this.data.constructor.fromArray(gids)

					// XXX should we use collection.data.placeImage(..)???
					return this.joinCollect(null, collection, data) 
				}).bind(this)) }],
	joinCollect: ['Collections/$Merge view to collection...',
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
			collection = this.collectionGIDs[collection] || collection 
			if(collection == null || collection == MAIN_COLLECTION_TITLE){
				return }

			// if only collection is given, reset align to null...
			align = align === collection ? null : align

			// create collection if it does not exist...
			this.ensureCollection(collection)
				.then((function(c){
					var target = c.crop_stack ? 
						c.crop_stack[0] 
						: c.data
					//this.collections[collection].data.join(align, data || this.data.clone())
					var res = (data || this.data)
						.clone()
						.clear('unloaded')
						.join(align, target)

					var rorder = res.order.slice().reverse()

					// write to base data...
					if(c.crop_stack){
						c.crop_stack[0] = res

						c.crop_stack
							.concat([c.data])
							.forEach(function(data){
								data.order = data.order
									.reverse()
									.concat(rorder)
									.unique()
									.reverse() 
								data.updateImagePositions() })

					} else {
						c.data = res }

					// joining into the current collection...
					if(collection == this.collection){
						if(this.crop_stack){
							this.crop_stack[0] = res

							this.crop_stack
								.concat([this.data])
								.forEach(function(data){
									data.order = data.order
										.reverse()
										.concat(rorder)
										.unique()
										.reverse() 
									data.updateImagePositions() })

						} else {
							var cur = this.current
							this.data = res 
							this.data.current = cur } }
				}).bind(this)) }],
	// XXX undo: see .removeFromCrop(..) for a reference implementation...
	// 		this will need:
	// 			- .collect(..) to be able to place images...
	//			- also store image order as .data.order is cleared of 
	//				removed images...
	uncollect: ['Collections|Image/Remove from collection',
		core.doc`Remove gid(s) from collection...

			Remove current image from current collection...
			.uncollect()
			.uncollect('current')
				-> this

			Remove gid(s) from current collection...
			.uncollect(gid)
			.uncollect([gid, ..])
				-> this

			Remove gid(s) from collection...
			.uncollect(gid, collection)
			.uncollect([gid, ..], collection)
				-> this


		NOTE: this will remove any gid, be it image or ribbon.
		`,
		{
			mode: function(){ 
				return !this.collection && 'disabled' },
			// XXX two ways to go:
			//		- .collect(..) + .data.placeImage(..)
			//		- rewrite .collect(..) to use .data.placeImage(..) (like: .addToCrop(..))
			getUndoState: function(d){
				d.placements = this.data.getImagePositions(d.args[0])
				d.collection = d.args[1] 
					|| this.collection },
			// XXX this does not work yet...
			// 		...need to trigger .reload(..), and considering that
			// 		this is a UI action, doing so explicitly is logical...
			// XXX can we unify .collect(..) and .addToCrop(..)???
			// 		...they essentially do the same thing with one exception
			// 		a crop retains the full order while a collection has a 
			// 		cleared order...
			// 		..might also be a good idea to unify much of the 
			// 		collection and crop mechanics...
			undo: function(d){
				var that = this
				var gids = d.args[0] || [d.current]
				gids = gids instanceof Array ? gids : [gids]
				var collection = d.collection
				this
					// XXX is this the right approach???
					.collect(gids, collection)
					.ensureCollection(collection)
						.then(function(){
							d.placements.forEach(function(e){
								// XXX does not place correctly...
								that.data.placeImage(e[0], e[1], that.data.order[e[2]]) 
							that.reload(true)
						}) }) },
			//*/
		},
		function(gids, collection){
			collection = collection || this.collection
			collection = this.collectionGIDs[collection] || collection 
			if(collection == null 
					|| collection == MAIN_COLLECTION_TITLE
					|| !this.collections 
					|| !(collection in this.collections)){
				return }

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
				.flat()

			// remove from the loaded state...
			this.collection == collection
				&& this.data.clear(gids)

			// NOTE: we do both this and the above iff data is cloned...
			// NOTE: if tags are saved to the collection it means that 
			// 		those tags are local to the collection and we do not 
			// 		need to protect them...
			if(this.collections[collection].data 
					&& this.data !== this.collections[collection].data){
				this.collections[collection].data
					.clear(gids) } }],
	uncollectRibbon: ['Collections|Ribbon/Remove ribbon from collection',
		core.doc`Remove ribbons from collection...

			Remove current ribbon from current collection...
			.uncollectRibbon()
			.uncollectRibbon('current')
				-> this

			Remove gid(s) from current collection...
			.uncollectRibbon(gid)
			.uncollectRibbon([gid, .. ])
				-> this

			Remove gid(s) from collection...
			.uncollectRibbon(gid, collection)
			.uncollectRibbon([gid, .. ], collection)
				-> this


		NOTE: this is the same as .uncollect(..) but removes whole ribbons, 
			i.e. each gid given will be resolved to a ribbon which will be
			removed.
		`,
		{mode: 'uncollect'},
		function(gids, collection){
			var that = this
			gids = gids || 'current'
			gids = gids instanceof Array ? gids : [gids]
			gids = gids
				.map(function(gid){ 
					return that.data.getRibbon(gid) })
			return this.uncollect(gids, collection) }],


	// Serialization...
	//
	// NOTE: this will handle collection title and data only, the rest 
	// 		is copied in as-is.
	// 		It is the responsibility of the extending features to transform
	// 		their data on load as needed.
	load: [function(json){
		var that = this

		var collections = {}
		var c = json.collections || {}
		var order = json.collection_order || Object.keys(c)

		if((json.location || {}).collection){
			this.location.collection = json.location.collection }
			
		Object.keys(c)
			.forEach(function(title){
				if(c[title] === false){
					return }

				var state = collections[title] = { title: title }

				// load data...
				var d = c[title].data == null ?
						null
					: c[title].data instanceof data.Data ?
						c[title].data
					: data.Data.fromJSON(c[title].data)
				if(d){
					state.data = d }

				// image count...
				if(c[title].count){
					state.count = c[title].count }

				// NOTE: this can be done lazily when loading each collection
				// 		but doing so will make the system more complex and 
				// 		confuse (or complicate) some code that expects 
				// 		.collections[*].crop_stack[*] to be instances of Data.
				if(c[title].crop_stack){
					state.crop_stack = c[title].crop_stack
						.map(function(c){ 
							return c instanceof data.Data ? 
								c 
								: data.Data(c) }) }

				// copy the rest of collection data as-is...
				Object.keys(c[title])
					.forEach(function(key){
						if(key in state){
							return }
						state[key] = c[title][key] }) })

		return function(){
			if(Object.keys(collections).length > 0){
				this.collections = collections
				this.collection_order = order } } }],
	//
	// Supported modes:
	// 	current (default) 	- ignore collections
	// 	base				- save only base data in each collection and
	// 							the main collection is saved as current
	// 	full				- full current state.
	// 	
	// NOTE: we do not store .collection_order here, because we order 
	// 		the collections in the object.
	// 		...when saving a partial collection set, for example in
	// 		.prepareIndexForWrite(..) it would be necessary to add it 
	// 		in to maintain the correct order when merging... (XXX)
	// NOTE: currently this only stores title and data, it is the 
	// 		responsibility of extending features to store their specific 
	// 		stuff in collections...
	// 		XXX is this the right way to go???
	// NOTE: .chnages are handled separately in feature .handlers...
	json: [function(mode){ return function(res){
		mode = mode || 'current'

		var collections = this.collections || {}
		var order = this.collection_order

		// NOTE: if mode is 'current' ignore collections...
		if(mode != 'current' && order.length > 0){
			// NOTE: .collection_order does not return MAIN_COLLECTION_TITLE 
			// 		so we have to add it in manually...
			order = MAIN_COLLECTION_TITLE in collections ?
				order.concat([MAIN_COLLECTION_TITLE])
				: order

			// in base mode save the main view as current...
			if(mode == 'base' && this.collection){
				var main = collections[MAIN_COLLECTION_TITLE]
				res.data =  (main.crop_stack ? 
						(main.crop_stack[0] || main.data)
						: main.data)
					.json()

				delete res.location.collection }

			res.collections = {}
			order.forEach(function(title){
				// in base mode skip the main collection...
				if(mode == 'base' 
						&& title == MAIN_COLLECTION_TITLE){
					return }

				var state = collections[title]

				// collection does not exist (default collection)...
				// XXX
				if(state == null){
					res.collections[title] = false
					return }

				// build the JSON...
				var s = res.collections[title] = { title: title }
				if(state.gid){
					s.gid = state.gid }
				var data = ((mode == 'base' && state.crop_stack) ? 
						(state.crop_stack[0] || state.data)
						: state.data)
				if(data){
					s.data = data.json()
					s.count = data.length

				} else if(state.count) {
					s.count = state.count }

				// handle .crop_stack of collection...
				// NOTE: in base mode, crop_stack is ignored...
				if(mode != 'base' && state.crop_stack){
					s.crop_stack = state.crop_stack
						.map(function(d){ return d.json() }) } }) } } }],
	clone: [function(full){
		return function(res){
			if(this.collections){
				var cur = this.collections

				if(this.collection){
					res.location.collection = this.collection }

				collections = res.collections = {}
				this.collection_order
					.forEach(function(title){
						var c = collections[title] = {
							title: title,
						}

						if(cur[title].data){
							c.data = cur[title].data.clone() }

						if(cur[title].crop_stack){
							c.crop_stack = cur[title].crop_stack
								.map(function(d){ return d.clone() }) } }) } } }],

	clear: [function(){
		this.collection
			&& this.collectionUnloaded('*')
		delete this.collections
		delete this.__collection_order
		delete this.location.collection }],


	// Config and interface stuff...
	//
	toggleCollectionCropRetention: ['Interface/Collection crop save mode',
		{mode: 'advancedBrowseModeAction'},
		core.makeConfigToggler(
			'collection-save-crop-state', 
			[
				'all',
				'main', 
				'none',
			])],
	// XXX can we combine a toggler with list editor???
	toggleCollections: ['- Collections/Collections',
		toggler.Toggler(null,
			function(_, state){
				return state == null ?
					// cur state...
					(this.collection 
						|| MAIN_COLLECTION_TITLE)
					// new state...
					: (this.loadCollection(state) 
						&& state) },
			function(){ 
				return [MAIN_COLLECTION_TITLE].concat(this.collection_order || []) })],
})

var Collection = 
module.Collection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'collections',
	depends: [
		'cache',
		'base',
		'location',
		'crop',
	],
	suggested: [
		'collections-local-config',
		'collection-tags',
		'collection-marks',
		'auto-collections',

		'ui-collections',
		'ui-collection-marks',
		'fs-collections',
	],

	actions: CollectionActions, 

	handlers: [
		// save before we serialize...
		['json.pre',
			function(){ this.saveCollection() }],


		// Handle changes...
		//
		// 	Global tags:
		// 		'collections'	- mark collection list as changed
		// 		'collection: <gid>'	
		// 						- collection-specific changes
		//
		// 	Collection-specific tags:
		// 		'metadata'		- marks metadata as changed
		// 							NOTE: this is ignored for the base 
		// 								collection...
		//
		// 	Collection-local tags (see: .config['collection-transfer-changes']):
		// 		'metadata'
		// 		'data'
		//
		//
		//	Mark collection list as changed...
		// 	.markChanged('collections')
		// 		NOTE: this will not affect collections...
		// 		NOTE: this is useful alone when removing collections...
		//
		// 	Mark tag as changed when collection is loaded...
		// 	.markChanged(<tag>)
		// 		NOTE: this only applies to collection-local or specific tags...
		//
		// 	Mark tag as changed when collection is not loaded...
		// 	.markChanged('collection: '+JSON.stringify(<gid>), [<tag>, ..])
		//
		//
		// collection add/remove...
		[[
			'collectionCreated',
			'collectionRemoved',
		],
			function(_, collection){
				// collection list changed...
				this.markChanged('collections')
				// collection changed...
				collection in this.collections
					&& this.markChanged(
						'collection: '
							+JSON.stringify(this.collections[collection].gid || collection))
			}],
		// collection list sort...
		['sortCollections.pre',
			function(){
				var o = (this.collection_order || []).slice()

				return function(){
					;(this.collection_order || [])
							.filter(function(e, i){ return e != o[i] }).length > 0
						&& this.markChanged('collections') } }],
		// collection title/list...
		['renameCollection',
			function(_, from, to){
				this
					.markChanged('collections')
					.markChanged('collection: '
						+ JSON.stringify(this.collections[to].gid), ['metadata']) }],
		// basic collection edits...
		[[
			// NOTE: no need to handle .collect(..) here as it calls .joinCollect(..)
			'joinCollect.pre',
			'uncollect.pre',
		], 
			function(){
				var that = this
				var args = [...arguments]
				var title = (args.length == 1 ? args[0] : args[1]) || this.collection
				var collection = (this.collections || {})[title] || {}

				var count = collection.data ? 
					collection.data.length 
					: collection.count

				return function(){
					// NOTE: if a collection does not exist by this point 
					// 		it will be handled by collection .collectionCreated(..)
					// 		...this means we are either creating a new collection
					// 		or removing from a non-existing collection.
					title in this.collections
						&& this.ensureCollection(title)
							.then(function(){
								var new_count = collection.data ? 
									collection.data.length 
									: collection.count

								new_count != count
									&& that.markChanged('collections')
									&& that.markChanged(
										'collection: '
											+JSON.stringify(collection.gid || title),
										['data']) }) } }],
		['joinCollect',
			function(_, align, collection, data){
				var args = [...arguments]
				var title = (args.length == 1 ? args[0] : args[1]) || this.collection
				var collection = (this.collections || {})[title] || {}

				data = data || this.data

				;(!data || data.ribbon_order.length > 1)
					&& this.markChanged(
						'collection: '
							+JSON.stringify(collection.gid || title),
						['data']) }],
		// transfer changes on load/unload collection...
		['collectionLoading.pre',
			function(to){
				var that = this
				var from = this.collection || MAIN_COLLECTION_TITLE
				if(from == to || this.changes === undefined || this.changes === true){
					return }

				var change_tags = this.config['collection-transfer-changes'] 
					|| COLLECTION_TRANSFER_CHANGES

				var from_changes = change_tags
					.filter(function(item){
						return that.changes === true || (that.changes || {})[item] })

				return function(){
					if(to == from){
						return }
					var gid = (this.collections[to] || {}).gid || to
					var changes = this.changes !== false ? 
						this.changes['collection: '+JSON.stringify(gid)] 
						: []
					var from_id = 'collection: '
						+JSON.stringify(from == MAIN_COLLECTION_TITLE ?
							MAIN_COLLECTION_GID
							: this.collections[from].gid || from)

					// everything has changed, no need to bother with details...
					if(changes === true){
						return }

					// save changes to 'from'...
					from_changes.length > 0
						&& this.markChanged(from_id, from_changes)

					// load changes from 'to'..
					change_tags.forEach(function(item){
						if(changes && changes.indexOf(item) >= 0){
							that.markChanged(item)

						} else if(that.changes && that.changes[item]){
							delete that.changes[item] } }) } }],
		// update current collection changes...
		//
		// This will:
		// 	1) update .changes['collection: <gid>'] with the current
		// 		loaded .changes state...
		// 	2) in 'base' mode, update the res.changes with base data 
		// 		changes...
		//
		// NOTE: we do not need to do anything on the .load(..) side...
		['json.pre', 
			function(mode){
				var cur = this.collection || MAIN_COLLECTION_TITLE
				if(cur == null || cur == MAIN_COLLECTION_TITLE){
					return }

				var changes = this.changes

				// everything/nothing changed -- nothing to do...
				if(!changes || changes === true || changes[cur] === true){
					return }

				var gid = this.collectionGID
				var id = 'collection: '+ JSON.stringify(gid)
				var change_tags = this.config['collection-transfer-changes']
					|| COLLECTION_TRANSFER_CHANGES

				var changed = change_tags 
					.filter(function(tag){
						return changes[tag] === true })

				if(changed.length > 0 && this.changes[id] !== true){
					this.changes[id] = (this.changes[id] || [])
						.concat(changed)
						.unique() }

				// reset the base change tags to the base data (from collection data)...
				if(mode == 'base'){
					return function(res){
						var base_id = 'collection: '+ JSON.stringify(MAIN_COLLECTION_GID)
						var base = this.changes[base_id] || []

						// no need to save the base collection changes...
						delete res.changes[base_id]

						// clear...
						change_tags.forEach(function(tag){
							delete res.changes[tag] })
						// set...
						base.forEach(function(tag){
							res.changes[tag] = true }) } } }],


		// Handle collection serialization format...
		//
		// Return format:
		// 	{
		// 		...
		//
		// 		// Collection gid-title index...
		//		//
		// 		// NOTE: this is sorted via .collection_order in .json(..)...
		// 		// 
		// 		// NOTE: if .collections is undefined this is not returned...
		// 		// XXX this may cause issues if after removing the 
		// 		//		last collection and .collections is deleted,
		// 		//		then the last saved collection state will 
		// 		//		get loaded instead of an empty collection list
		// 		//		...currently this is not a problem as .collections
		// 		//		is never explicitly set to undefined, but is a 
		// 		//		potential pitfall...
		// 		//		Q: should this return {} when .collections is undefined?
		// 		collections: {
		// 			// normal collection...
		// 			<gid>: {
		// 				title: <title>,
		// 				count: <count>,
		// 				...
		// 			},
		//
		// 			// un-initialise default collection...
		// 			//
		// 			// i.e. a collection that is included in 
		// 			// .config['default-collections'] and thus present in
		// 			// .collection_order but not present in .collections
		// 			<gid>: false,
		//
		// 			...
		// 		}
		//
		// 		// Collection metadata...
		// 		'collections/<gid>/metadata': {
		// 			gid: <gid>,
		// 			title: <title>,
		// 			...
		// 		},
		//
		// 		// Collection index data...
		//		//
		// 		// NOTE: this can contain the same tags as the root index
		// 		//		this the collection format is the same as the 
		// 		//		containing index format...
		// 		// 		This is built by: 
		// 		//			.prepareIndexForWrite(
		// 		//				<collection-data>, 
		// 		//				<collection-changes>)
		// 		//		Where:
		// 		//			<collection-data>
		// 		//				taken as-is from .collections[gid] as 
		// 		//				returned by .json(..)
		// 		//			<collection-changes>
		// 		//				built from .changes['collection: <gid>']
		// 		//		And placed under path:
		// 		//			collections/<gid>
		// 		// NOTE: as the collection index is recursive, care must
		// 		//		be taken when/if nested collections are needed
		// 		//		to avoid self referencing...
		// 		'collections/<gid>/<tag>': <tag-data>,
		//
		// 		...
		// 	}
		//
		//
		// NOTE: the base collection (MAIN_COLLECTION_TITLE) is not saved 
		// 		in collections, it is stored in the root index...
		//
		// XXX we do not need .count in collection metadata as it is 
		// 		stored in collections...
		['prepareIndexForWrite', 
			function(res){
				if(!res.changes){
					return }
				var that = this
				var changes = res.changes
				var collections = this.collections

				// collections fully/partially changed...
				var full = changes === true ? 
					Object.keys(collections || {})
					: Object.keys(collections || {})
						.filter(function(t){ 
							return res.changes['collection: '
								+ JSON.stringify(collections[t].gid)] === true })
				var partial = changes === true ? []
					: Object.keys(collections || {})
						.filter(function(t){ 
							return full.indexOf(t) < 0
								&& res.changes['collection: '
									+ JSON.stringify(collections[t].gid)] })

				// collection index...
				// NOTE: we are placing this in the index root to 
				// 		simplify lazy-loading of the collection 
				// 		index...
				// NOTE: if there are no collections defined this section
				// 		is skipped...
				if(collections 
						&& changes 
						&& (changes === true 
							|| changes.collections)){
					//var index = res.index['collection-index'] = {}
					var index = res.index['collections'] = {}
					// NOTE: we do not need to use .collection_order here
					// 		as .json(..) returns the collections in the 
					// 		correct order...
					Object.keys(res.raw.collections || {})
						.forEach(function(title){ 
							if(title in collections){
								var gid = (collections[title] || {}).gid || title
								var m = index[gid] = { title: title }

								if(res.raw.collections[title].count){
									m['count'] = res.raw.collections[title].count }

							// empty / default collections (placeholders)...
							} else {
								index[title] = false } }) }

				// collections...
				if((full.length > 0 || partial.length > 0)
						&& res.raw.collections){
					// select the actual changed collection list...
					changed = changes === true ? 
						Object.keys(res.raw.collections)
						: (full).concat(partial)

					var change_tags = this.config['collection-transfer-changes']
						|| COLLECTION_TRANSFER_CHANGES

					changed
						// skip the raw field...
						.filter(function(k){ 
							return res.raw.collections[k] 
								&& changed.indexOf(k) >= 0 })
						.forEach(function(k){
							var gid = res.raw.collections[k].gid || k
							var id = 'collection: '+ JSON.stringify(gid)
							var path = 'collections/'+ gid
							var raw = res.raw.collections[k]

							// local collection changes...
							var local_changes = partial.indexOf(k) < 0 || {}
							if(local_changes !== true && res.changes[id] !== true){
								(res.changes[id] || [])
									.forEach(function(c){ 
										local_changes[c] = true }) }

							// collections/<gid>/metadata
							var metadata = {}
							if(full.indexOf(k) >= 0 
									|| res.changes[id].indexOf('metadata') >= 0){
								res.index[path +'/metadata'] = metadata }
							Object.keys(raw)
								.forEach(function(key){ metadata[key] = raw[key] })

							raw.date = res.date
							var prepared = that.prepareIndexForWrite(raw, local_changes).index

							// move the collection data to collection path...
							Object.keys(prepared)
								.filter(function(key){ return key != 'collections' })
								.forEach(function(key){
									res.index[path +'/'+ key] = prepared[key]
									delete metadata[key] })
							// cleanup metadata...
							// XXX do we need this???
							change_tags.forEach(function(key){
								delete metadata[key] }) }) } }],
		// XXX merge multiple collections...
		// 		...this can be called multiple times pre single load, once
		// 		per merged index...
		['prepareIndexForLoad',
			function(res, json, base_path){
				// collection index...
				var collections = {}
				var collections_index = {}

				var index = json['collections']

				if(index){
					// get collection order...
					var order = Object.keys(index)
						.map(function(k){ 
							return index[k] ? index[k].gid || index[k].title || k : k })
					if(order.length > 0){
						res.collection_order = order }

					// collection data...
					Object.keys(index).forEach(function(gid){
						if(index[gid] === false){
							return }

						//var title = index[gid]
						var title = index[gid].title || index[gid]
						var path = 'collections/'+ gid

						var m = collections_index[gid] = collections[title] = {
							gid: gid,
							title: title,

							// XXX
							path: path,
						}

						if(index[gid].count){
							m.count = index[gid].count } }) }

				if(Object.keys(collections).length > 0){
					res.collections = collections }

				// group collection data...
				//
				// NOTE: this will load collections/* stuff if present...
				//
				// XXX would be nice to have a mechanism to pass info to 
				// 		the loader on what paths to load without actually 
				// 		loading them manually...
				// 		...without this mechanism the data used here would
				// 		not exist...
				var collection_data = {}
				Object.keys(json)
					.filter(function(k){ return k.startsWith('collections/') })
					.forEach(function(k){
						var s = k.split(/[\\\/]+/g).slice(1)
						var gid = s.shift()
						var key = s.shift()
						var title = collections_index[gid].title

						// load only collections in index...
						if(title){
							var data = collection_data[gid] = collection_data[gid] || {}

							// overwrite metadata...
							if(key == 'metadata'){
								collections_index[gid] = collections[title] = json[k]

							// other stuff -> collection data...
							} else {
								data[key] = json[k] } } })

				// XXX prepare collection data for loading...
				Object.keys(collection_data)
					.forEach(function(gid){
						// XXX would be nice to be able to use .prepareIndexForLoad(..) 
						// 		to handle collection internals produced by
						// 		.prepareIndexForLoad(..)...
						// 		...would need to pass it the local data...
						// XXX
					})
			}],

		// invalidate caches...
		[[
			'loadCollection',
			'uncollect',
		],
			'clearCache: "view(-.*)?" "*" -- Clear view cache'],
	],
})



//---------------------------------------------------------------------

var CollectionLocalConfig = actions.Actions({
	config: {
		// XXX should this be user editable???
		// XXX should/can this be local to collection???
		'collection-local-config': [
		],
	},

	// handle collection .config
	// XXX problems:
	// 		- config leaks -- when moving crom collection to collection 
	// 			with individual option sets some options may not get 
	// 			restored if handled incorrectly...
	// 			...one way to deal with this is to restore the base config
	// 			on every load before loading the new config...
	collectionConfigLoader: ['- Collections/',
		{collectionFormat: 'config'},
		function(title, state, logger){ 
			// XXX save old config -- in their respective collection...

			// XXX load MAIN_COLLECTION_TITLE config...

			// XXX load new config -- from target collection... 
		}],
})

var CollectionLocalConfig = 
module.CollectionLocalConfig = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'collections-local-config',
	depends: [
		'collections',
	],

	handlers: [
		/* XXX
		['collectionLoading.pre',
			function(){
				var that = this
				var state = {}
				var opts = this.config['collection-local-config'] || []

				// save outgoing collection state...
				var cfg = {}
				opts.forEach(function(n){
					cfg[n] = JSON.parse(JSON.stringify(that.config[n])) 
				})
			}],
		//*/
	],
})



//---------------------------------------------------------------------

var CollectionTagsActions = actions.Actions({
	config: {
		// List of tags to be stored in a collection, unique to it...
		//
		// NOTE: the rest of the tags are shared between all collections
		// NOTE: to disable local tags either delete this, set it to null
		// 		or to an empty list.
		'collection-local-tags': [],
		
		/*
		'collection-transfer-changes': 
			// XXX need a way to exrtend config values in order of merge
			// 		and not manually...
			CollectionActions.config['collection-transfer-changes']
				.concat([
				]),
		//*/
	},

	collectTagged: ['- Collections|Tag/',
		function(query, collection){
			return this.collect(this.data.tagQuery(query), collection) }],
	uncollectTagged: ['- Collections|Tag/',
		function(query, collection){
			return this.uncollect(this.data.tagQuery(query), collection) }],
})

// XXX need to either extend this to use the tag API to support the 
// 		compound tags or explicitly restrict this to specific tags...
// 		...currently this in places uses the API and in other places
// 		directly accesses .__index -- this may lead to odd cases where
// 		not all tags get loaded/unloaded in spite of correctly conforming 
// 		to the API specs...
var CollectionTags = 
module.CollectionTags = core.ImageGridFeatures.Feature({
	title: 'Collection tag handling',
	doc: core.doc`
	What this does:
	- Makes tags global through all collections
	- Handles local tags per collection


	Global tags:
	------------

	Global tags are shared through all the collections, this helps keep
	image-specific tags, keywords and meta-information stored in tags 
	global, i.e. connected to specific image and not collection. 

	Global tags are stored in .data.tags and cleared out of from the 
	collection's: 
		.collections[<title>].data


	Collection local tags:
	----------------------

	Local tags are listed in .config['collection-local-tags'], this makes
	selection, bookmarking and other process related tags local to each 
	collection.

	Collection-local tags are stored in .collections[<title>].local_tags
	and overwrite the corresponding tags in .data.tags on collection load.

	`,

	tag: 'collection-tags',

	depends: [
		'collections',
		'tags',
	],

	actions: CollectionTagsActions,

	handlers: [
		// move tags between collections...
		['collectionLoading.pre',
			function(title){
				var that = this
				var local_tag_names = this.config['collection-local-tags'] || []
				var tags = this.data.tags

				// NOTE: this is done at the .pre stage as we need to grab 
				// 		the tags BEFORE the data gets cleared (in the case 
				// 		of MAIN_COLLECTION_TITLE)...
				var local_tags = (this.collections[title] || {}).local_tags || {}

				return function(){
					tags.__index = tags.__index || {}

					// load local_tags...
					local_tag_names
						.forEach(function(tag){ 
							/* XXX for some reason this does not work...
							tags.tag(tag, [...(local_tags[tag] 
									|| that.data.tags.values(tag))])
							/*/
							// XXX this is not correct as we can have mixed tags...
							// 		...use actual tag API...
							tags.__index[tag] = new Set(local_tags[tag] 
								|| (that.data.tags.__index || {})[tag] 
								|| [])
							//*/
						})

					;(this.crop_stack || [])
						.forEach(function(d){ d.tags = tags })
					this.data.tags = tags } }],
		// remove tags from unloaded collections...
		['collectionUnloaded',
			function(_, title){
				if(title in this.collections 
						&& 'data' in this.collections[title]){
					delete this.collections[title].data.tags } }],
		// remove tags when saving...
		['saveCollection.pre',
			function(title, mode, force){
				var that = this
				title = title || this.collection || MAIN_COLLECTION_TITLE
				var local_tag_names = this.config['collection-local-tags'] || []

				// do not do anything for main collection unless force is true...
				if(title == MAIN_COLLECTION_TITLE && !force){
					return }

				// we need this to prevent copy of tags on first save...
				var new_set = !(title in (this.collections || {}))

				return function(){
					// save local tags...
					var local_tags = this.collections[title].local_tags = {}
					local_tag_names
						.forEach(function(tag){ 
							/* XXX not sure which approach is better, 
							//		API vs. direct .__index edit...
							local_tags[tag] = (!new_set || title == MAIN_COLLECTION_TITLE) ? 
								// XXX this might yield a slightly wider set of values...
								new Set(that.data.tags.values(tag))
								: new Set()
							/*/
							// XXX this is not correct as we can have mixed tags...
							// 		...use actual tag API...
							local_tags[tag] = (!new_set || title == MAIN_COLLECTION_TITLE) ? 
								[...(that.data.tags.__index || {})[tag] || []]
								: []
							//*/
						})

					// delete the .data.tags of the collections...
					delete (this.collections[title].data || {}).__tags || {} }
			}],
		// prevent .uncollect(..) from removing global tags...
		// XXX this seems a bit hacky (???)
		['uncollect.pre',
			function(_, gids, title){
				var that = this
				var local_tag_names = this.config['collection-local-tags'] || []
				gids = gids || this.current
				gids = gids instanceof Array ? gids : [gids]

				// prevent global tag removal...
				var tags = this.data.tags

				return function(){
					// update local tags...
					tags.untag(local_tag_names, gids) } }],
		// save .local_tags to json...
		// NOTE: we do not need to explicitly load anything as .load() 
		// 		will load everything we need...
		['json',
			function(res, mode){
				var c = this.collections
				var rc = res.collections

				// NOTE: at this point .crop_stack is handled, so we 
				// 		do not need to care about it...

				// in 'base' mode set .data.tags and .local_tags to 
				// the base collection data...
				if(mode == 'base' 
						&& this.collection != null
						&& this.collection != MAIN_COLLECTION_TITLE){
					var tags = this.data.tags.json()
					var ltags = c[MAIN_COLLECTION_TITLE].local_tags || {}
					var rtags = res.data.tags.tags = {}

					// move all the tags...
					Object.keys(tags.tags)
						.filter(function(tag){ return ltags[tag] == null })
						.forEach(function(tag){ rtags[tag] = tags.tags[tag] })
					// overwrite the local tags for the base...
					Object.keys(ltags)
						.forEach(function(tag){ rtags[tag] = ltags[tag] }) }

				// clear tags for all collections...
				rc
					&& Object.keys(rc || {})
						// XXX skip unloaded collections...
						.filter(function(title){ return !!rc[title].data })
						.forEach(function(title){
							rc[title].data.tags.tags = c[title].local_tags }) }],
		// load collection local tags from .data.tags to .local_tags...
		// ...this is needed if the collections are fully loaded as part 
		// of the index...
		// XXX do we actually need this???
		['load',
			function(_, json){
				var that = this
				this.collections
					&& Object.keys(json.collections || {})
						// skip loaded collections that are already Data objects...
						// XXX not sure about this...
						.filter(function(title){
							return !(json.collections[title].data instanceof data.Data) })
						// do the loading...
						.forEach(function(title){
							var c = that.collections[title]

							if(!c || !c.data){
								return }

							var t = (c.data.tags || {}).tags || {}
							var lt = c.local_tags = c.local_tags || {}

							;(that.config['collection-local-tags'] || [])
								.forEach(function(tag){
									lt[tag] = new Set(lt[tag] || t[tag] || []) }) }) }],
	],
})



//---------------------------------------------------------------------

// XXX add UI...
// XXX removing items from auto-collection has no effect as it will be 
// 		reconstructed on next load -- is this the right way to go???
var AutoCollectionsActions = actions.Actions({
	collectionAutoLevelLoader: ['- Collections/',
		core.doc`

		`,
		{collectionFormat: 'level_query'},
		function(title, state){ 
			return new Promise((function(resolve){
				var source = state.source || MAIN_COLLECTION_TITLE
				source = source == MAIN_COLLECTION_TITLE ? 
					((this.crop_stack || [])[0] 
						|| this.data)
					// XXX need a way to preload collection data...
					: ((this.collection[source].crop_stack || [])[0] 
						|| this.collections[source].data)

				var query = state.level_query
				query = query == 'top' ? 
						[0, 1]
					: query == 'bottom' ?
						[-1]
					: query instanceof Array ? 
						query
					: typeof(query) == typeof('str') ? 
						query.split('+').map(function(e){ return e.trim() })
					: query > 0 ? 
						[0, query]
					: [query]
				query = query[0] == 'top' ?
						[0, parseInt(query[1])+1]
					: query[0] == 'bottom' ?
						[-parseInt(query[1])-1]
					: query

				var levels = source.ribbon_order.slice.apply(source.ribbon_order, query)

				var gids = []
				levels.forEach(function(gid){
					source.makeSparseImages(source.ribbons[gid], gids) })
				gids = gids.compact()

				// get items that topped matching the query...
				var remove = state.data ?
					state.data.order
						.filter(function(gid){ return gids.indexOf(gid) < 0 })
					: []

				// build data...
				state.data = data.Data.fromArray(gids)
					// join with saved state...
					.join(state.data || data.Data())
					// remove unmatching...
					.clear(remove)

				resolve()
			}).bind(this)) }],
	makeAutoLevelCollection: ['- Collections/',
		core.doc`Make level auto-collection...

		`,
		function(title, source, a, b){
			// XXX query 
			var query = b != null ? [a, b] : a

			this.saveCollection(title, 'empty')

			this.collections[title].level_query = query
			this.collections[title].source = source }],

	// XXX do we need real tag queries???
	collectionAutoTagsLoader: ['- Collections/',
		core.doc`

		NOTE: this will ignore local tags.
		NOTE: this will prepend new matching items to the saved state.
		`,
		{collectionFormat: 'tag_query'},
		function(title, state){ 
			return new Promise((function(resolve){
				var local_tag_names = this.config['collection-local-tags'] || []

				var tags = (state.tag_query || [])
					.filter(function(tag){ 
						return local_tag_names.indexOf(tag) < 0 })

				var gids = this.data.tagQuery(tags)

				// get items that topped matching the query...
				var remove = state.data ?
					state.data.order
						.filter(function(gid){ return gids.indexOf(gid) < 0 })
					: []

				// build data...
				state.data = data.Data.fromArray(gids)
					// join with saved state...
					.join(state.data || data.Data())
					// remove unmatching...
					.clear(remove)

				resolve()
			}).bind(this)) }],
	makeAutoTagCollection: ['- Collections/',
		core.doc`Make tag auto-collection...

			Make a tag auto-collection...
			.makeAutoTagCollection(title, tag)
			.makeAutoTagCollection(title, tag, tag, ..)
			.makeAutoTagCollection(title, [tag, tag, ..])
				-> this

		NOTE: at least one tag must be supplied...
		`,
		function(title, tags){
			tags = arguments.length > 2 ? [...arguments].slice(1) : tags
			tags = tags instanceof Array ? tags : [tags]

			if(tags.length == 0){
				return }
			this.saveCollection(title, 'empty')
			this.collections[title].tag_query = tags }],
})

var AutoCollections =
module.AutoCollections = core.ImageGridFeatures.Feature({
	title: 'Auto collections',
	doc: core.doc`
	A collection is different from a crop in that it:
		- preserves ribbon state
		- preserves order
		- preserves local tags

	Tag changes are handled by removing images that were untagged (no 
	longer matching) from the collection and adding newly tagged/matching 
	images to collection.
	`,

	tag: 'auto-collections',
	depends: [
		'collections',
	],

	actions: AutoCollectionsActions,

	handlers: [
		['json',
			function(res){
				var c = this.collections || {}
				var rc = res.collections || {}

				Object.keys(rc)
					.forEach(function(title){
						var cur = c[title]
						var r = rc[title]

						if(!cur){
							return }

						// XXX is this the right way to go???
						if('tag_query' in cur){
							r.tag_query = cur.tag_query

						} else if('level_query' in cur){
							r.level_query = cur.level_query
							if(cur.source){
								r.source = cur.source } } }) }],
	],
})



//---------------------------------------------------------------------

// Make an action that when called without enough arguments show a 
// collection selector dialog and just call the given function when 
// enough arguments are given.
//
// NOTE: if n > 1 and <n args are given then the given args will get 
// 		passed to func with an appended title...
// XXX should we use options object here a-la .browseCollections(..)???
var mixedModeCollectionAction = function(func, n, options){
	return widgets.uiDialog(function(){
		var args = [...arguments]
		// check if minimum number of arguments is reached...
		return args.length < (n || 1) ? 
			// show the dialog...
			this.browseCollections(function(title){ 
					return func.call(this, ...args.concat([title])) }, options) 
			: func.apply(this, args) }) }

// Like mixedModeCollectionAction(..) but will do nothing if enough args 
// are given...
var collectionGetterWrapper = function(func, n, options){
	return widgets.uiDialog(function(){
		var args = [...arguments]
		// check if minimum number of arguments is reached...
		return args.length < (n || 1)
			// show the dialog...
			&& this.browseCollections(function(title){ 
					return func.call(this, ...args.concat([title])) }, 
				options) }) }


// - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - 

// XXX show collections in image metadata... (???)
// XXX might be nice to indicate if a collection is loaded -- has .data???
// XXX might be nice to add collection previews to the collection list...
// 		...show the base ribbon from collection as background
var UICollectionActions = actions.Actions({
	config: {
		// Last used collection (for adding merging)...
		//
		// This will be auto-selected in .browseCollections(..) on next 
		// add/edit operation...
		//'collection-last-used': null,
		
		// can be:
		// 		'end' | null	- place new items at end of list
		// 		'start'			- place new items at start of list
		//
		// XXX edit this with a toggler???
		'collection-ui-place-new': 'start',
	},

	// UI...
	//
	// XXX would be nice to make this nested (i.e. path list) -- collection grouping... (???)
	// XXX should we use options object instead of arguments???
	// XXX might need to check (in a standard way) that nothing is loaded...
	browseCollections: ['Collections/$Collections...',
		core.doc`Collection list...

			.browseCollections(action, options)
				-> dialog


		options format:
			{
				new_message: null | false | <str>,

				last_used: <bool> | <title>,

				show_main: null | <bool> | <func>,
			}


		All arguments are optional.

		If action is given options.last_used defaults to true.

		If options.last_used is true then .config['collection-last-used']
		is used to select the last used collection and set when selecting
		an item.
		It options.last_used is a string, then .config[options.last_used]
		will be used to store the last used collection title.

		NOTE: collections are added live and not on dialog close...
		`,
		//widgets.makeUIDialog(function(action, new_message, last_used_collection){
		widgets.makeUIDialog(function(action, options={}){
			var that = this

			var {new_message, last_used, show_main} = options
			last_used = options.last_used == null ? 
					(action && 'collection-last-used')
				: options.last_used === true ? 
					'collection-last-used' 
				: options.last_used
			var to_remove = []

			var collections = that.collection_order = 
				//(that.collection_order || []).slice()
				that.collection_order.slice()

			//var defaults = that.config['default-collections'] || []
			//collections = collections.concat(defaults).unique()

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
						.on('update', function(){
							dialog.filter(JSON.stringify((that.collection || MAIN_COLLECTION_TITLE)
									.replace(/\$/g, '')))
								.addClass('highlighted') })

					// nothing loaded...
					// NOTE: we have to check both .data and .collection as
					// 		we can have an empty collection loaded -- empty
					// 		.data but a set .collection...
					if(that.data.length == 0 && that.collection == null){
						make.Empty('No collections...')
						return }

					var openHandler = function(_, title){
						var title = $(this).find('.text').attr('text') || title
						// create collection if it does not exist...
						if(!that.collections 
								|| !(title in that.collections)){
							that.newCollection(title) }

						var gid = that.current
						action ?
							action.call(that, title)
							: that.loadCollection(title)
						that.focusImage(gid)
						dialog.close() }
					var setItemState = function(title){
						var gid = ((that.collections || {})[title] || {}).gid || title
						// handle main collection changes...
						gid = title == MAIN_COLLECTION_TITLE ? 
							MAIN_COLLECTION_GID 
							: gid

						var text = this.find('.text').last()

						// saved state...
						var unsaved = that.changes === true 
							|| (that.changes || {})['collection: '+ JSON.stringify(gid)]
							|| (that.collectionGID == gid 
								&& (that.config['collection-transfer-changes']
										|| COLLECTION_TRANSFER_CHANGES)
									.filter(function(a){ 
										return !!(that.changes || {})[a] }).length > 0)
						unsaved
							&& text.attr('unsaved', true)

						// collection crop...
						var cs = 
							title == (that.collection || MAIN_COLLECTION_TITLE) ? 
								that.crop_stack
							: (that.collections || {})[title] ?
								that.collections[title].crop_stack
							: null
						cs
							&& text.attr('cropped', cs.length)

						// collection size...
						var c = (that.collections || {})[title] || {}
						var i = (c.data && c.data.length)
								|| c.count
								|| false 
						// main collection loaded...
						i = (!i && title == MAIN_COLLECTION_TITLE && !that.collection) ?
							that.data.length 
							: i
						i && $(this).attr('count', i) }

					// update collection list if changed externally...
					/* XXX
					collections.splice.apply(collections, 
						// NOTE: if the length calculation here looks a "bit"
						// 		convoluted, that's because it is, this fixes
						// 		a really odd bug in old Chrome versions where
						// 			L.splice(0, L.length, ...) 
						// 		in some odd conditions leaves an element 
						// 		in the original array...
						// 		(is a jit error???)
						[0, (that.collection_order || []).length + collections.length]
							.concat(collections
								.concat(that.collection_order || [])
								.unique()))
					/*/
					console.log('>>>>', that.collection_order)
					collections
						.splice(0, collections.length,
							...[
								...collections,
								...(that.collection_order || []),
							].tailUnique())
					//*/

					// main collection...
					var main = typeof(show_main) == 'function' ?
						show_main.call(that)
						: show_main
					;(main === true
							|| (main == null && !action))
						&& collections.indexOf(MAIN_COLLECTION_TITLE) < 0
						&& make([MAIN_COLLECTION_TITLE], 
							{ 
								events: {
									update: function(_, title){
										// make this look almost like a list element...
										// XXX hack???
										$(this).find('.text:first-child')
											.before($('<span>')
												.css('color', 'transparent')
												.addClass('sort-handle')
												.html('&#x2630;'))
										setItemState
											//.call($(this), title)
											.call($(this), $(this).find('.text').attr('text'))
									},
									open: openHandler,
								},
								// NOTE: we are adding a blank button here 
								// 		to align item counts...
								// XXX HACK: can we automate this -- html5 grid layout???
								buttons: [['&times;']],
							})

					// collection list...
					make.EditableList(collections, 
						{
							new_item: new_message ? 
									new_message 
								// explicitly disabled new item...
								: (new_message === false || new_message === null) ?
									false
								: action ? 
									'$New...' 
								: '$New from current state...',
							place_new_item: that.config['collection-ui-place-new'],

							unique: true,
							sortable: 'y',
							to_remove: to_remove,

							itemopen: openHandler,

							normalize: function(title){ 
								return title.trim() },
							check: function(title){ 
								return title.length > 0 },

							each: setItemState, 

							itemadded: function(title){
								action ?
									that.newCollection(title)
									: that.saveCollection(title) },

							disabled: (main === false 
									|| (main == null && action)) ? 
								[MAIN_COLLECTION_TITLE] 
								: false,

							update_merge: 'merge',

							// XXX REVISE...
							itemedit: function(_, from, to){
								that.renameCollection(from, to)

								// rename was successful...
								if(to in that.collections){
									collections[collections.indexOf(from)] = to } }, }) }, 
				{
					cls: 'collection-list',
					// focus current collection...
					selected: (last_used 
							&& that.config[last_used]) ?
						that.config[last_used]
						: JSON.stringify(
							(that.collection || MAIN_COLLECTION_TITLE)
								// XXX not sure it is good that we have to do this...
								.replace(/\$/g, '')),
				})
				.open(function(_, title){
					last_used
						&& (that.config[last_used] = title) })
				.close(function(){
					that.collection_order = collections
					to_remove
						.forEach(function(title){ 
							that.removeCollection(title) }) }) })],
	// XXX should this be able to add new collections???
	browseImageCollections: ['Collections|Image/Image $collections...',
		widgets.makeUIDialog(function(gid){
			var that = this
			gid = this.data.getImage(gid)

			var defaults = this.config['default-collections']

			var all
			var collections
			var to_remove
			var t

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
						.on('update', function(){
							dialog.filter(JSON.stringify((that.collection || MAIN_COLLECTION_TITLE)
									.replace(/\$/g, '')))
								.addClass('highlighted') })

					all = all || that.collection_order || []
					if(defaults){
						all.splice.apply(all, 
							[0, all.length]
								.concat(all.concat(defaults).unique())) }

					// load collections...
					var loading = all
						.filter(function(c){
							return (that.collections || {})[c] 
								&& !that.collections[c].data })
						.map(function(c){ 
							that
								.ensureCollection(c) 
								.then(function(collection){
									collection.data.getImage(gid || that.current) ?
										collections.push(c)
										: to_remove.push(c.replace(/\$/g, ''))

									// NOTE: we'll avoid calling update 
									// 		too often...
									clearTimeout(t)
									t = setTimeout(function(){
										dialog.update() }, 100) }) 
							return c })
					
					// containing collections...
					collections = collections
						|| that.inCollections(gid || null)
							.filter(function(title){ 
								return loading.indexOf(title) < 0 })

					// build the disabled list...
					if(!to_remove){
						to_remove = []
						all.forEach(function(title){
							collections.indexOf(title) < 0
								&& loading.indexOf(title) < 0
								&& to_remove.push(title.replace(/\$/g, '')) }) }

					all.length > 0 ?
						make.EditableList(all, 
							{
								new_item: false,
								sortable: 'y',
								disabled: loading,
								to_remove: to_remove,
								itemopen: function(_, title){
									var i = to_remove.indexOf(title)
									i >= 0 ? 
										to_remove.splice(i, 1) 
										: to_remove.push(title)
									dialog.update() },
								itemedit: function(_, from, to){
									that.renameCollection(from, to)
									all[all.indexOf(from)] = to
									that.collection_order = all },
							})
						: make.Empty('No collections...') })
				.close(function(){
					that.collection_order = all

					all.forEach(function(title){
						collections.indexOf(title) < 0
							&& to_remove.indexOf(title.replace(/\$/g, '')) < 0
							&& that.collect(gid, title) })
					to_remove.forEach(function(title){ 
						that.uncollect(gid, title) }) }) })],


	// Collection actions with collection selection...
	//
	// XXX need to add "ALL" -- might need to rework .browseCollections(..) for this...
	// XXX also do:
	// 		.saveCollection(..)
	// XXX EXPERIMENTAL...
	// 		...we might not actually need this as this essentially will
	// 		do the same thing as .browseCollections(..)
	// 		...combining this with .browseCollections(..) might complicate
	// 		things as we still need to reuse the later for other things...
	loadCollection: [
		collectionGetterWrapper(function(title){ this.loadCollection(title) })],
	loadMainCollection: ['Collections/Exit collection view',
		{
			mode: 'uncollect', 
			// prevent this from showing up in .uiDialogs list...
			__dialog__: false,
		},
		`loadCollection: "${MAIN_COLLECTION_TITLE}"`],

	// XXX extend .saveCollection(..) and remove this...
	// 		...see .loadCollection(..) notes above...
	// XXX should we warn the user when overwriting???
	saveAsCollection: ['Collections/$Save as collection...',
		mixedModeCollectionAction(function(title){
			this.saveCollection(title, 'current') 
			// XXX should we be doing this manually here or in .saveCollection(..)
			title == this.collection
				&& this.loadCollection('!') })],
	collect: [
		collectionGetterWrapper(function(gids, title){ 
			if(title == null){
				title = gids
				gids = null }
			this.collect(gids || 'current', title) }, 2)],
	collectRibbon: ['Collections|Ribbon/Add $ribbon to collection...',
		'collect: "ribbon"'],
	collectLoaded: ['Collections/$Add loaded images to collection...',
		'collect: "loaded"'],
	joinCollect: [
		collectionGetterWrapper(function(title){ this.joinCollect(title) })],

	// XXX do we need this???
	cropImagesInCollection: ['Collections|Crop/Crop images in collection...',
		{mode: function(){ 
			return (!this.collections 
					|| Object.keys(this.collections).length == 0) 
				&& 'disabled' }},
		mixedModeCollectionAction(function(title){
				var that = this
				this.ensureCollection(title)
					.then(function(collection){
						var images = collection.data.getImages('all')
						that.crop(images, false) }) }, 
			null,
			{ last_used: false })],
	cropOutImagesInCollection: ['Collections|Crop/Remove collection images from crop...',
		{mode: 'cropImagesInCollection'},
		mixedModeCollectionAction(function(title){
				var that = this
				this.ensureCollection(title)
					.then(function(collection){
						var to_remove = collection.data.getImages('all')
						var images = that.data.getImages('loaded')
							.filter(function(gid){ return to_remove.indexOf(gid) < 0 })
						that.crop(images, false) }) }, 
			null,
			{ last_used: false })],

	// XXX should this be in Collections/ ???
	editDefaultCollections: ['Interface|Collections/Edit default collections...',
		widgets.makeConfigListEditorDialog(
			'default-collections', 
			{
				cls: 'collection-list',

				unique: true,
				sortable: 'y',

				normalize: function(title){ 
					return title.trim() },
				check: function(title){ 
					return title.length > 0 
						&& title != MAIN_COLLECTION_TITLE },
			})],

	/*/ XXX this is not used by metadata yet...
	metadataSection: ['- Image/',
		function(gid, make){
			// XXX
		}],
	//*/
	

	/*/ XXX experementing...
	//		would be nice to:
	//			- have an action accessible within the action menu and standalone
	//			- topology:
	//				<collection>/
	//					<collection-option>: <value>
	//					...
	//				...
	//			- creating a collection should open its options...
	//
	collectionsList: ['Collections/Collections list/*',
		function(path, make){
			make.EditableList(this.collection_order)
		}],
	//*/
	

	// XXX doc...
	collectionSort: ['- Collections/',
		core.doc`Sort collection A (sorted) as collection B (sort_as)...

			.collectionSort(sorted, sort_as)
			.collectionSort(sorted, sort_as, mode)
				-> promise(A, B)


		NOTE: in spite of the name this can also sort the main data/collection.
		NOTE: if either sorted or sort_as are not given or are null the main 
			collection is assumed by default.
		NOTE: if sorted and sort_as are the same collection this will do nothing.
		`,
		function(sorted, sort_as, mode='in-place'){
			var that = this
			var sort = mode == 'in-place' ?
				'inplaceSortAs'
				: 'sortAs'
			if(sorted == sort_as){
				return Promise.resolve() }
			// NOTE: need to update view if the sorted collection is loaded...
			var loaded = sorted == this.collection
			return Promise.all([
				this.ensureCollection(sorted),
				this.ensureCollection(sort_as),
			]).then(function([sorted, sort_as]){
				sorted.data.order[sort](sort_as.data.order)
				sorted.data.updateImagePositions() 
				loaded
					 && that.sortImages('update') }) }],

	// XXX revise naming...
	sortAsCollection: ['Sort|Collections/Sort as collection...',
		core.doc`Sort current collection as selected.`,
		{sortMethod: true,
		mode: function(){
			return this.collections_length > 0 || 'disabled' }, },
		mixedModeCollectionAction(
			function(sort_as){
				return this.collectionSort(this.collection, sort_as) },
			null,
			{ show_main: function(){ 
				return !!this.collection } })],
	sortCollectionAsThis: ['Sort|Collections/Sort collection as current...',
		core.doc`Sort selected collection as current.`,
		{sortMethod: true,
		mode: 'sortAsCollection', },
		mixedModeCollectionAction(
			function(sorted){
				return this.collectionSort(sorted, this.collection) },
			null,
			{ show_main: function(){ 
				return !!this.collection } })],
})

var UICollection = 
module.UICollection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-collections',
	depends: [
		'ui',
		'collections',

		// XXX needed only for .addMarkedToCollection(..)
		'collection-tags',
	],

	actions: UICollectionActions, 

	handlers: [
		// we need to do this as we transfer tags after everything is 
		// loaded...
		['collectionLoading',
			function(){
				this.reload() }],

		// update view when editing current collection...
		[[
			'uncollect', 
			'joinCollect',
		],
			function(_, gids, collection){
				(collection == null || this.collection == collection)
					&& this.reload(true) }],

		// maintain crop viewer state when loading/unloading collections...
		['load clear reload collectionLoading collectionUnloaded',
			function(){
				if(!this.dom){
					return }
				this.dom[this.collection ? 
					'addClass' 
					: 'removeClass']('collection-mode')
				this.dom[this.cropped ? 
					'addClass' 
					: 'removeClass']('crop-mode') }],
	],
})



//---------------------------------------------------------------------

var CollectionMarksActions = actions.Actions({
	config: {
		'collection-local-tags': 
			// XXX need a way to exrtend config values in order of merge
			// 		and not manually...
			CollectionTagsActions.config['collection-local-tags']
				.concat([
					'bookmark',
					'marked',
				]),
		
		'collection-transfer-changes': 
			// XXX need a way to exrtend config values in order of merge
			// 		and not manually...
			//CollectionTagsActions.config['collection-transfer-changes']
			CollectionActions.config['collection-transfer-changes']
				.concat([
					'bookmarked', 
					'marked',
				]),
	},

	// marked...
	collectMarked: ['- Collections|Mark/',
		function(collection){
			return this.collect(this.marked, collection) }],
	uncollectMarked: ['Collections|Mark/Remove marked from collection',
		{mode: function(){ 
			return (!this.collection 
					|| this.marked.length == 0) 
				&& 'disabled' }},
		function(collection){
			return this.uncollect(this.marked, collection) }],

	// bookmarked...
	collectBookmarked: ['- Collections|Bookmark/',
		function(collection){
			return this.collectTagged('bookmark', collection) }],
	uncollectBookmarked: ['Collections|Bookmark/Remove bookmarked from collection',
		{mode: function(){ 
			return (!this.collection || this.bookmarked.length == 0) && 'disabled' }},
		function(collection){
			return this.uncollectTagged('bookmark', collection) }],
})

var CollectionMarks = 
module.CollectionMarks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'collection-marks',
	depends: [
		'marks',
		'collection-tags',
		'ui-collections',
	],

	actions: CollectionMarksActions,
})



//---------------------------------------------------------------------

var UICollectionMarksActions = actions.Actions({
	// UI...
	// XXX should these be a separate feature???
	markImagesInCollection: ['Collections|Mark/$Mark images in collection...',
		{mode: 'cropImagesInCollection'},
		mixedModeCollectionAction(function(title){
			var that = this
			this.ensureCollection(title)
				.then(function(collection){
					var images = collection.data.getImages('all')
					that.toggleMark(images, 'on') }) })],
	addMarkedToCollection: ['Collections|Mark/Add marked to $collection...',
		{mode: function(){ 
			return this.marked.length == 0 
				&& 'disabled' }},
		mixedModeCollectionAction(function(title){ 
			this.collectMarked(title) })],
})

var UICollectionMarks = 
module.UICollectionMarks = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-collection-marks',
	depends: [
		'collection-marks',
		'ui-collections',
	],

	actions: UICollectionMarksActions,
})



//---------------------------------------------------------------------
// XXX Things to try/do:
// 		- load directories as collections (auto?)...
// 		- export collections to directories...
// 		- auto-export collections (on save)...
// 			- add new images
// 			- remove old images...

var FileSystemCollectionActions = actions.Actions({

	// Format:
	// 	{
	// 		path: <string>,
	// 		...
	// 	}
	collections: null,

	// XXX this does not work for merged indexes as each index has 
	// 		different gids and paths for same collection title...
	// 		...need to merge these correctly...
	// 			- merge collections by title
	// 			- multiple gids
	// 			- multiple paths
	collectionPathLoader: ['- Collections/',
		{collectionFormat: 'path'},
		function(title, state, logger){ 
			var that = this

			// if data is present, do not reload...
			if(state.data){
				return }

			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Load')

			return Promise.all((this.location.loaded || [this.location.path])
				.map(function(path){
					path = util.normalizePath([
						path,
						that.config['index-dir'], 
						// XXX use index-specific path...
						state.path,
					].join('/'))

					return file.loadIndex(path, false, logger)
						.then(function(res){
							// load the collection data...
							that.collections[title].data = 
								that.prepareIndexForLoad(res[path]).data }) })) }],

	// XXX revise...
	// XXX this should be generic... (???)
	// 		...I think the action itself should be generic, but what this
	// 		specific action does is very specific to file collections...
	// 		...think of a protocol))))
	unloadUnchangedCollections: ['Collections|File/Unload saved collections',
		function(logger){
			var that = this

			if(this.changes === true || this.changes === undefined){
				return }

			// XXX get a logger...
			logger = logger || this.logger
			logger = logger && logger.push('Unload')

			Object.keys(this.collections)
				.forEach(function(title){
					var c = that.collections[title] 

					var key = 'collection: '+JSON.stringify(c.gid || title)

					if(title != MAIN_COLLECTION_TITLE
							&& title != that.collection
							&& c.path 
							&& c.data
							&& (that.changes === false 
								|| !(key in that.changes))){

						logger && logger.emit('title', title)

						c.count = c.data.length
						delete c.data } }) }],

	importCollectionsFromPath: ['- Collections|File/Import collections from path',
		function(path){
			// XXX
		}],
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
	],
})



//---------------------------------------------------------------------
// XXX localstorage-collections (???)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
