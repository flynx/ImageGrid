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

var MAIN_COLLECTION_TITLE = 'ALL'

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
// XXX local tags:
// 		- save -- done, test
// 		- load
// 		- save/merge use...
// XXX selection/tag based .collect()/.uncollect() actions...
// XXX undo...
var CollectionActions = actions.Actions({
	config: {
		// can be:
		// 	'all'		- save crop state for all collections (default)
		// 	'main'		- save crop state for main state only
		// 	'none'		- do not save crop state
		'collection-save-crop-state': 'all',

		// List of tags to be stored in a collection, unique to it...
		'collection-local-tags': [
			'bookmark',
			'selected',
		],

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

	get collection(){
		return this.location.collection },
	set collection(value){
		this.loadCollection(value) },

	// XXX should this check consistency???
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

		// keep MAIN_COLLECTION_TITLE out of the collection order...
		var m = res.indexOf(MAIN_COLLECTION_TITLE)
		m >= 0
			&& res.splice(m, 1)

		// remove stuff not present...
		if(res.length > keys.length){
			res = res.filter(function(e){ return e in collections })
		}

		this.__collection_order.splice(0, this.__collection_order.length, ...res)

		return this.__collection_order
	},
	set collection_order(value){
		this.__collection_order = value },

	get collections_length(){
		var c = (this.collections || {})
		return MAIN_COLLECTION_TITLE in c ? 
			Object.keys(c).length - 1
			: Object.keys(c).length
	},

	// Format:
	// 	{
	// 		// NOTE: this is always the first handler...
	// 		'data': <action-name>,
	//
	// 		<format>: <action-name>,
	// 		...
	// 	}
	//
	// XXX should these get auto-sorted???
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

		This will not clone .data, this all changes made to it are 
		persistent.
		`,
		{collectionFormat: 'data'},
		function(title, data){ 
			return new Promise(function(resolve){ resolve(data.data) }) }],

	// XXX load local_tags...
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

		NOTE: cached collection state is persistent.
		`,
		function(collection){
			var that = this
			if(collection == null 
					|| this.collections == null 
					|| !(collection in this.collections)){
				return
			}
			var crop_mode = this.config['collection-save-crop-state'] || 'all'

			var current = this.current
			var ribbon = this.current_ribbon

			var prev = this.collection
			var collection_data = this.collections[collection]
			var handlers = this.collection_handlers

			// save current collection state...
			//
			// main view...
			if(this.collection == null){
				var tags = this.data.tags

				this.saveCollection(
					MAIN_COLLECTION_TITLE, 
					crop_mode == 'none' ?  'base' : 'crop', 
					true)

				// keep the tags...
				this.collections[MAIN_COLLECTION_TITLE].data.tags = tags

			// collection...
			} else {
				this.saveCollection(
					this.collection, 
					crop_mode == 'all' ? 'crop': null)
			}

			// load collection...
			for(var format in handlers){
				if(collection_data[format]){
					return this[handlers[format]](collection, collection_data)
						.then(function(data){
							if(!data){
								return
							}

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

							data.tags = that.data.tags

							// XXX load local_tags...
							// XXX

							// NOTE: tags and other position dependant 
							// 		data needs to be updated as collections
							// 		may contain different numbers/orders of
							// 		images...
							// XXX
							//data.updateImagePositions()
							data.sortTags()

							that.load({
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
								that.data.collection = that.location.collection = collection
								// cleanup...
								if(collection == null){
									delete this.location.collection
								}
							}

							// collection events...
							that
								.collectionUnloaded(prev || MAIN_COLLECTION_TITLE)
								.collectionLoaded(collection)	
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
		})],
	collectionUnloaded: ['- Collections/',
		core.doc`This is called when unloading a collection.
		`,
		core.notUserCallable(function(collection){
			// This is the window resize event...
			//
			// Not for direct use.
		})],

	// XXX saving into current collection will leave the viewer in an 
	// 		inconsistent state:
	// 			- collection X is indicated as loaded
	// 			- collection X has different state than what is loaded
	// 		...not sure how to deal with this yet...
	saveCollection: ['- Collections/',
		core.doc`Save current state to collection

			Save Current state to current collection
			.saveCollection()
			.saveCollection('current')
				-> this
				NOTE: this will do nothing if no collection is loaded.

			Save Current state as collection
			.saveCollection(collection)
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

		`,
		function(collection, mode, force){
			var that = this
			collection = collection || this.collection
			collection = collection == 'current' ? this.collection : collection

			if(!force 
					&& (collection == null 
						|| collection == MAIN_COLLECTION_TITLE)){
				return
			}

			var depth = typeof(mode) == typeof(123) ? mode : null
			mode = depth == 0 ? null 
				: depth ? 'crop' 
				: mode

			var collections = this.collections = this.collections || {}

			// prepare local lags...
			//var local_tags = {}
			// XXX
			var local_tags = (collections[collection] || {}).local_tags || {}
			;(this.config['collection-local-tags'] || [])
				.forEach(function(tag){ 
					local_tags[tag] = local_tags[tag] || [] })

			var state = collections[collection] = {
				title: collection,

				// NOTE: we do not need to care about tags here as they 
				// 		will get overwritten on load...
				data: (mode == 'empty' ? 
							(new this.data.constructor())
						: mode == 'base' && this.crop_stack ? 
							(this.crop_stack[0] || this.data.clone())
						: mode == 'crop' ? 
							this.data.clone()
						: this.data.clone()
							.run(function(){
								var d = this
								this.collection = collection

								// save local tags...
								Object.keys(local_tags)
									.forEach(function(tag){ 
										local_tags[tag] = (d.tags[tag] || []).slice() })

								// optimization: 
								// 		avoid processing .tags as we'll 
								// 		overwrite them anyway later...
								delete this.tags 
							})
							.clear('unloaded')),

				local_tags: local_tags,
			}

			if(mode == 'crop' && this.crop_stack && depth != 0){
				depth = depth || this.crop_stack.length
				depth = this.crop_stack.length - Math.min(depth, this.crop_stack.length)

				state.crop_stack = this.crop_stack.slice(depth)
			}
		}],
	newCollection: ['- Collections/',
		function(collection){ return this.saveCollection(collection, 'empty') }],
	// XXX should we do anything special if collection is loaded???
	removeCollection: ['- Collections/',
		function(collection){
			if(collection == MAIN_COLLECTION_TITLE){
				return
			}
			delete this.collections[collection]
		}],

	inCollections: ['- Image/',
		core.doc`Get list of collections containing item`,
		function(gid){
			var that = this
			gid = this.data.getImage(gid)
			//return Object.keys(this.collections || {})
			return (this.collection_order || [])
				.filter(function(c){
					return c != MAIN_COLLECTION_TITLE
						&& (!gid 
							|| that.collections[c].data.getImage(gid)) })
		}],

	collect: ['- Collections/',
		core.doc`Add items to collection

		NOTE: this will not account for item topology.`,
		function(gids, collection){
			collection = collection || this.collection
			if(collection == null || collection == MAIN_COLLECTION_TITLE){
				return
			}
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
			if(collection == null || collection == MAIN_COLLECTION_TITLE){
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
			collection = collection || this.collection
			if(collection == null || collection == MAIN_COLLECTION_TITLE){
				return
			}

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

			if(this.collection == collection){
				// need to keep this from updating .tags...
				// XXX this seems a bit hacky...
				var tags = this.data.tags
				delete this.data.tags

				this.data
					.clear(gids)
					.run(function(){
						this.tags = tags
						this.sortTags()
					})
			}

			// NOTE: we do both this and the above iff data is cloned...
			// NOTE: if tags are saved to the collection it means that 
			// 		those tags are local to the collection and we do not 
			// 		need to protect them...
			if(this.data !== this.collections[collection].data){
				this.collections[collection].data
					.clear(gids)
			}
		}],


	// Serialization...
	//
	// NOTE: this will handle collection title and data only, the rest 
	// 		is copied in as-is.
	// 		It is the responsibility of the extending features to transform
	// 		their data on load as needed.
	//
	// XXX handle local_tags...
	load: [function(json){
		var that = this

		var collections = {}
		var c = json.collections || {}
		var order = json.collection_order || Object.keys(c)

		if((json.location || {}).collection){
			this.location.collection = json.location.collection
		}
			
		Object.keys(c).forEach(function(title){
			// load data...
			var d = c[title].data instanceof data.Data ?
				c[title].data
				: data.Data
					.fromJSON(c[title].data
					.run(function(){
						this.tags = this.tags || that.data.tags
					}))

			var state = collections[title] = {
				title: title,

				data: d,
			}

			// NOTE: this can be done lazily when loading each collection
			// 		but doing so will make the system more complex and 
			// 		confuse (or complicate) some code that expects 
			// 		.collections[*].crop_stack[*] to be instances of Data.
			if(c[title].crop_stack){
				state.crop_stack = c[title].crop_stack
					.map(function(c){ 
						return c instanceof data.Data ? 
							c 
							: data.Data(c) })
			}

			// copy the rest of collection data as-is...
			Object.keys(c[title])
				.forEach(function(key){
					if(key in state){
						return
					}

					state[key] = c[title][key]
				})
		})

		return function(){
			if(Object.keys(collections).length > 0){
				this.collection_order = order
				this.collections = collections
			}
		}
	}],
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
	// 		data in collections...
	//
	// XXX handle local_tags...
	json: [function(mode){ return function(res){
		mode = mode || 'current'

		var collections = this.collections

		// NOTE: if mode is 'current' ignore collections...
		if(mode != 'current' && collections){
			var order = this.collection_order
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
					.dumpJSON()

				delete res.location.collection
			}

			res.collections = {}
			order.forEach(function(title){
				// in base mode skip the main collection...
				if(mode == 'base' && title == MAIN_COLLECTION_TITLE){
					return
				}

				var state = collections[title]

				var data = ((mode == 'base' && state.crop_stack) ? 
						(state.crop_stack[0] || state.data)
						: state.data)
					.dumpJSON()
				delete data.tags

				var s = res.collections[title] = {
					title: title,
					data: data, 
				}

				// handle .crop_stack of collection...
				// NOTE: in base mode, crop_stack is ignored...
				if(mode != 'base' && state.crop_stack){
					s.crop_stack = state.crop_stack
						.map(function(d){ return d.dumpJSON() })
				}
			})
		}
	} }],
	clone: [function(full){
		return function(res){
			if(this.collections){
				var cur = this.collections

				if(this.collection){
					res.location.collection = this.collection
				}

				collections = res.collections = {}
				this.collection_order
					.forEach(function(title){
						var c = collections[title] = {
							title: title,
						}

						if(cur[title].data){
							c.data = cur[title].data.clone()
						}

						if(cur[title].crop_stack){
							c.crop_stack = cur[title].crop_stack
								.map(function(d){ return d.clone() })
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

	// Config...
	toggleCollectionCropRetention: ['Interface/Collection crop save mode',
		core.makeConfigToggler('collection-save-crop-state', ['all', 'main', 'none'])],
})


var Collection = 
module.Collection = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'collections',
	depends: [
		'base',
		'location',
		'crop',
	],
	suggested: [
		'ui-collections',
		'fs-collections',
	],

	actions: CollectionActions, 

	handlers: [
		// XXX maintain changes...
		// 		- collection-level: mark collections as changed...
		// 		- in-collection:
		// 			- save/restore parent changes when loading/exiting collections
		// 			- move collection chnages to collections
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
			function(res, json, base_path){
				// XXX
			}],
	],
})



//---------------------------------------------------------------------

// XXX show collections in image metadata...
var UICollectionActions = actions.Actions({
	browseCollections: ['Collections|Crop/$Collec$tions...',
		core.doc`Collection list...

		NOTE: collections are added live and not on dialog close...
		`,
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

					var openHandler = function(_, title){
						var gid = that.current
						action ?
							action.call(that, title)
							: that.loadCollection(title)
						that.focusImage(gid)
						dialog.close()
					}
					var setCroppedState = function(title){
						// indicate collection crop...
						var cs = 
							title == (that.collection || MAIN_COLLECTION_TITLE) ? 
								that.crop_stack
							: (that.collections || {})[title] ?
								that.collections[title].crop_stack
							: null
						cs
							&& this.find('.text').last()
								.attr('cropped', cs.length)
					}

					//var collections = Object.keys(that.collections || {})
					var collections = that.collection_order = that.collection_order || []

					// main collection...
					!action && collections.indexOf(MAIN_COLLECTION_TITLE) < 0
						&& make([
								MAIN_COLLECTION_TITLE,
							], 
							{ events: {
								update: function(_, title){
									// make this look almost like a list element...
									// XXX hack???
									$(this).find('.text:first-child')
										.before($('<span>')
											.css('color', 'transparent')
											.addClass('sort-handle')
											.html('&#x2630;'))
									setCroppedState
										.call($(this), title)
								},
								open: openHandler,
							}})

					// collection list...
					make.EditableList(collections, 
						{
							unique: true,
							sortable: 'y',
							to_remove: to_remove,

							itemopen: openHandler,

							normalize: function(title){ 
								return title.trim() },
							check: function(title){ 
								return title.length > 0 },

							each: setCroppedState, 

							itemadded: function(title){
								action ?
									that.newCollection(title)
									: that.saveCollection(title) },

							disabled: action ? [MAIN_COLLECTION_TITLE] : false,
						})
				}, {
					cls: 'collection-list',
					// focus current collection...
					selected: that.collection || MAIN_COLLECTION_TITLE,
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
								itemopen: function(_, title){
									var i = to_remove.indexOf(title)

									i >= 0 ? 
										to_remove.splice(i, 1) 
										: to_remove.push(title)

									dialog.update()
								},
							})
						: make.Empty('No collections...')
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
		// update view when removing from current collection...
		['uncollect',
			function(_, gids, collection){
				(collection == null || this.collection == collection)
					&& this.reload(true)
			}],

		// maintain crop viewer state when loading/unloading collections...
		['load clear reload collectionLoaded collectionUnloaded',
			function(){
				if(!this.dom){
					return
				}
				this.dom[this.collection ? 
					'addClass' 
					: 'removeClass']('collection-mode')

				this.dom[this.cropped ? 
					'addClass' 
					: 'removeClass']('crop-mode')
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
	],
})



//---------------------------------------------------------------------
// XXX localstorage-collections (???)




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
