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
var widgets = require('features/ui-widgets')

var browse = require('lib/widget/browse')



/*********************************************************************/
// Tags...

// mode can be:
// 	"ribbon"	- next marked in current ribbon (default)
// 	"all"		- next marked in sequence
//
// XXX add support for tag lists...
var makeTagWalker =
module.makeTagWalker =
function(direction, dfl_tag){
	var meth = direction == 'next' ? 'nextImage' : 'prevImage'
	return function(tag, mode){
		this[meth](this.data.tags.values(tag || dfl_tag), mode) } }


//---------------------------------------------------------------------

var TagsActions = 
module.TagsActions = actions.Actions({
	// Navigation...
	//
	prevTagged: ['- Navigate/Previous image tagged with tag',
		makeTagWalker('prev')],
	nextTagged: ['- Navigate/Next image tagged with tag',
		makeTagWalker('next')],
})

var Tags =
module.Tags = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'tags',
	depends: [
		'base',
	],
	suggested: [
		'tags-edit',
	],

	actions: TagsActions,
})



//---------------------------------------------------------------------
// Persistent tags (tree) 
//
// XXX add save/load tree to fs...
// XXX
var PersistentTagsActions = actions.Actions({
})


var PersistentTags = 
module.PersistentTags = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'persistent-tags',
	depends: [
		'base',
	],
	actions: PersistentTagsActions, 

	handlers: [],
})



//---------------------------------------------------------------------

var TagsEditActions = 
module.TagsEditActions = actions.Actions({
	// tags...
	//
	// XXX mark updated...
	tag: ['- Tag/Tag image(s)',
		{journal: true},
		function(tags, gids){
			gids = gids || this.current
			gids = gids instanceof Array ? gids : [gids]
			// XXX this is slow for very large data sets...
			gids = this.data.getImages(gids)

			tags = tags instanceof Array ? tags : [tags]

			var that = this

			if(gids.length == 0){
				return
			}

			// data...
			this.data.tag(tags, gids)

			// images...
			var images = this.images
			gids.forEach(function(gid){
				var img = images[gid] = images[gid] || {}
				img.tags = img.tags || []

				img.tags = img.tags.concat(tags).unique()

				// XXX mark updated...
			})
		}],
	// XXX mark updated...
	untag: ['- Tag/Untag image(s)',
		{journal: true},
		function(tags, gids){
			gids = gids || this.current
			gids = gids instanceof Array ? gids : [gids]
			tags = tags instanceof Array ? tags : [tags]

			// data...
			this.data.untag(tags, gids)

			// images...
			var images = this.images
			gids.forEach(function(gid){
				var img = images[gid]
				if(img == null || img.tags == null){
					return
				}

				img.tags = img.tags.filter(function(tag){ return tags.indexOf(tag) < 0 })

				if(img.tags.length == 0){
					delete img.tags
				}

				// XXX mark updated...
			})
		}],
	// Sync tags...
	//
	// 	Sync both ways...
	//	.syncTags()
	//	.syncTags('both')
	//
	//	Sync from .data
	//	.syncTags('data')
	//
	//	Sync from .images
	//	.syncTags('images')
	//
	//	Sync from <images> object
	//	.syncTags(<images>)
	//
	// NOTE: mode is data.tagsToImages(..) / data.tagsFromImages(..) 
	// 		compatible...
	// NOTE: setting source to 'both' and mode to 'reset' is the same as
	// 		'images' and 'reset' as all .data tags will be lost on first 
	// 		pass...
	syncTags: ['Tag/-10:Synchronize tags between data and images',
		{journal: true},
		function(source, mode){
			// can't do anything if either .data or .images are not 
			// defined...
			if(this.images == null){
				return
			}

			source = source || 'both'
			mode = mode || 'merge'

			var images = this.images

			if(typeof(source) != typeof('str')){
				images = source
				source = 'images'
			}

			if(source == 'data' || source == 'both'){
				this.data.tagsToImages(images, mode)
			}
			if(source == 'images' || source == 'both'){
				this.data.tagsFromImages(images, mode)
			}
		}],
})

var TagsEdit =
module.TagsEdit = core.ImageGridFeatures.Feature({
	title: '',

	tag: 'tags-edit',
	depends: [
		'tags',
		'edit',
	],

	actions: TagsEditActions,

	handlers: [
		// tags and images...
		// NOTE: tags are also stored in images...
		['tag untag',
			function(_, tags, gids){
				var that = this
				var changes = []

				gids = gids || this.current
				gids = gids instanceof Array ? gids : [gids]
				gids = this.data.getImages(gids)

				tags = tags || []
				tags = tags instanceof Array ? tags : [tags]

				// tags...
				if(tags.length > 0){
					this.markChanged('tags')

					tags.indexOf('marked') >= 0
						&& this.markChanged('marked')

					tags.indexOf('bookmark') >= 0
						&& this.markChanged('bookmarked')
				}

				this.markChanged('images', gids)
			}],

		// store .tags and .tags.marked / .tags.bookmark separately from .data...
		//
		// XXX see if this can be automated...
		['prepareIndexForWrite', 
			function(res){
				var changes = res.changes

				if(!changes || !res.raw.data){
					return
				}

				if((changes === true || changes.tags) && res.raw.data.tags){
					res.index.tags = res.raw.data.tags
				}

				// XXX should we save an empty list *iff* changes.marked is true???
				if(changes === true || changes.marked){
					res.index.marked = 
						(res.raw.data.tags.tags || {}).marked || []
				}
				// XXX should we save an empty list *iff* changes.bookmarked is true???
				if(changes === true || changes.bookmarked){
					res.index.bookmarked = [
						(res.raw.data.tags.tags || {}).bookmark || [],
						{},
					]
				}

				// cleanup...
				if(res.index.data && res.index.data.tags){
					delete (res.index.data.tags.__index || {}).marked
					delete (res.index.data.tags.__index || {}).bookmark
					delete res.index.data.tags
				}
			}],
		// merge the tags into data...
		['prepareIndexForLoad.pre',
			function(json){
				// NOTE: this is done before we build the data to let 
				// 		Data handle format conversion...
				json.data.tags = json.tags || {}
			}],
		// merge in marked and bookmark tags...
		['prepareIndexForLoad',
			function(res, json){
				res.data.tag('marked', json.marked || [])
				res.data.tag('bookmark', json.bookmarked ? json.bookmarked[0] : [])
			}],
		['load',
			function(){
				// XXX for now this is testing only...
				//this.data.tags.togglePersistent(this.config['tags-persistent'] || [], 'on')
				//this.data.tags.define(this.config['tags-definitions'] || [])
			}],
	],
})



//---------------------------------------------------------------------
// Tags UI...
//
// Provide the following interfaces:
// 	- cloud
// 	- tree
//
// Use-cases:
// 	- edit tag tree
// 	- edit image tags
//
var TagUIActions = actions.Actions({
	config: {
		// XXX should this be a list or a tree (list of paths)????
		// XXX support tag chains...
		// 		...a chain is a means to combine tags like:
		// 			vehicle/car + color/red can be represented as car:red
		// 			this would mean that an image both has a 'car' and 'red'
		// 			but also specifically states that it contains a 'red car'
		// 		...need to think of a good way to implement this...
		// 			...the obvious way is when tagging with 'car:red' to
		// 			tag the image with: 'car', 'red' and 'car:red'
		// 			Q: is 'car:red' the same as 'red:car'??
		// 			...feels that it should be...
		// XXX support tag paths as tags???
		// 		...a tag can be part of several paths, we should be able 
		// 		to use a specific one...
		// 		...an example would be something like:
		// 			species/man
		// 			people/man
		// 		Q: do we need this???
		// 		Q: can this be implemented via chains???
		// XXX should we have associative aliases???
		// 		like: 
		// 			'men' is 'many:man'
		// 			'women' is 'many:woman'
		// 			...
		// XXX need a tree api to query the tag tree...
		// 		.tagParents(tag)
		// 		.tagChildren(tag)
		// 		.tagOrpahns()
		// 		 ...
		// XXX should this be here or in .data???
		// XXX add "auto-tags" -- tags that are automatically added 
		// 		depending on specific rules, like:
		// 			orientation:landscape / orientation:portrait / orientation:square (???)
		// 		...these should not be settable by user...
		// XXX do a whitepaper (RFC?) on this system when done...
		'tags-persistent': [
			'count',
			'count/one',
			'count/two',
			'count/some',
			'count/many',

			'people',
			'people/crowd',
			'people/group',
			'people/couple',
			'people/man',
			'people/woman',
			'people/lady',
			'people/girl',
			'people/boy',
			'people/child',
			// ...

			'name',

			'role',
			'role/photographer',
			'role/artist',
			'role/painter',
			// ...

			'color',
			'color/red',
			'color/green',
			'color/blue',
			'color/white',
			'color/black',
			'color/orange',
			'color/yellow',
			'color/gray',
			// ...

			// XXX should this be 'type' or something else???
			'genre',
			'genre/documentary',
			'genre/landscape',
			'genre/portrait',
			'genre/wildlife',
			'genre/macro',
			'genre/abstract',
			'genre/sport',
			// ...

			'activity',
			'activity/sport',
			'activity/sport/football',
			'activity/sport/american-football',
			'activity/sport/baseball',
			'activity/sport/tennis',
			// ...
		],
		'tags-definitions': {
			// abstract...
			'entity': 'entity:one',
			'couple': 'entity:two',
			'entities': 'entity:many',

			// people...
			'man': 'man:one',
			'men': 'man:many',
			'woman': 'woman:one',
			'women': 'woman:one',
			'child': 'child:one',
			'children': 'child:many',
			'girl': 'girl:one',
			'girls': 'girl:many',
			'boy': 'boy:one',
			'boys': 'boy:many',
			'baby': 'baby:one',
			'babies': 'baby:one',

			'person': 'person:man:woman:girl:boy:child:baby:entity',
			'people': 'person:many',
			'crowd':  'person:man:woman:girl:boy:child:entity:many',
		}
	},

	// Tag cloud/list...
	//
	// XXX move this to the base tags feature...
	// XXX this is wrong, should point to either:
	// 			.data.tags.tags()
	// 		or:
	//			.data.tags
	get tags(){
		return []
			// XXX load this from a file...
			.concat((this.config['base-tags'] || [])
				// split tag paths...
				.map(function(e){ return e.split(/[\\\/]/g) })
				.flat()) 
			.concat(this.data ? this.data.tags.tags() : [])
   			.unique() },

	// XXX lazy tag search/add dialog...
	// 		- initially empty
	// 		- focus dialog search
	// 		- on update show list of matching tags
	// XXX

	// XXX add support for tag sets and paths...
	showTagCloud: ['Tag|Edit|Image/$Tags...',
		core.doc`Show tags in cloud format...

			Show tags for current image...
			.showTagCloud([options])
			.showTagCloud('current'[, options])
				-> dialog

			Show tags for specific images...
			.showTagCloud(gid, ...[, options])
			.showTagCloud([gid, ...][, options])
				-> dialog


			Show tags for current image with custom constructor...
			.showTagCloud(func[, gid, ...][, options])
			.showTagCloud(func[, [gid, ...]][, options])
				-> dialog

			Show tags for gids image with custom constructor...
			.showTagCloud(func, gid, ... [, options])
			.showTagCloud(func, [gid, ...] [, options])
				-> dialog
				NOTE: for an example see: .cropTaggedFromCloud(..)


		The constructor func is called in the action context and has the
		following format:
			func(path, make, gids, opts)

		This uses the same option format as browse.makeLister(..) with 
		the following additions:
			{
				//
				// this can be:
				// 	'count' (default)
				// 	'name'
				sortTagsBy: 'count',

				// callback to be called when a tag state is flipped...
				//
				// NOTE: this if set will disable auto dialog update on 
				// 		item change, this should be done by itemOpen(..).
				itemOpen: <function(tag, state)>,

				// disable dialog update on item open...
				//
				// NOTE: this is ignored if itemOpen is set.
				lazyDialogUpdate: false,

				// 
				hideTagCount: false,

				// if false do not show the 'New...' button...
				noNewButton: false,
			}


		NOTE: if 'marked' is passed as one of the gids it will get 
			replaced with the list of marked gids...
		`,
		{dialogTitle: function(_, gids){ 
			return (gids.length == 1 && gids[0] == 'marked') ?
					'Marked image tags'
				: gids.length > 1 ?
					'Tags of: '+ gids.join(', ')
				: 'Current image tags' }},
		widgets.makeUIDialog(function(...gids){
			var that = this

			var func = gids[0] instanceof Function ? gids.shift() : null
			var opts = gids[gids.length-1] instanceof Object ? gids.pop() : {}

			gids = gids.length == 0 ? ['current'] : gids
			// handle 'marked' keyword...
			gids = gids
				.map(function(gid){
					return gid == 'marked' ? that.marked : gid })
				.flat()
				.unique()

			// XXX
			var removeTag = function(tag){
				console.log('REMOVE TAG:', tag)
				// XXX
			}

			return browse.makeLister(null, function(path, make){
				var tags = that.data.getTags(gids)
				var tagset = that.data.tags

				// tags...
				// XXX make this a group...
				// XXX indicate if some of the gids are tagged...
				// 		...need three states per tag:
				// 			- on		- all are tagged
				// 			- partial	- some are tagged
				// 			- off		- none are tagged
				// XXX add key binding to delete a tag...
				that.tags
					.sort()
					// prep for sort...
					.map(function(t, i){ 
						return [
							t, 
							i, 
							(that.data.tags.values(t) || []).length,
							tags.indexOf(t) >= 0 ] })
					// XXX add ability to sort by popularity, both local
					//		(selected tags) and global...
					.run(function(){
						return opts.sortTagsBy == 'name' ?
								this
							// usage and count...
							: this.sort(function(a, b){
								var ac = a[2]
								var bc = b[2]

								return (
									// keep set tags before unset...
									a[3] && !b[3] ?
										-1
									: !a[3] && b[3] ?
										1
									// sort by usage count...
									: ac != null && bc != null ? 
										bc - ac
									// keep used tags before unused...
									: ac == null ?
										1
									: bc == null ?
										-1
									// keep position...
									: a[0] - b[0] ) }) })
					.map(function(tag){
						// normalize...
						var count = tag[2]
						var tagged = tag[3]
						tag = tag[0]

						var text = tagset.translateTag ?
							tagset.translateTag(tag)
							: tag

						return make(text, {
							cls: tagged ? 'tagged' : '',
							style: {
								opacity: tagged ? '' : '0.3'
							},
							attrs: {
								count: opts.hideTagCount 
									|| (count == 0 ? null : count),
							},
							open: function(){
								var e = $(this)
								var on = e.css('opacity')
								on = on == '' || on == '1'

								e.css('opacity', on ? 0.3 : '')

								// NOTE: we are reversing the state here 
								// 		because 'on' contains the state 
								// 		prior to modification...
								opts.itemOpen ?
									(on ?
										opts.itemOpen.call(that, tag, false)
										: opts.itemOpen.call(that, tag, true))
									:(on ?
										that.untag(tag, gids)
										: that.tag(tag, gids))

								opts.itemOpen 
									|| opts.lazyDialogUpdate
									|| make.dialog.update()
							},
							buttons: [
								// remove tag button...
								//['&times;', removeTag.bind(that, tag) ],
							],
						})
					})

				if(!opts.noNewButton){
					make.Separator()

					make.Editable('$New...', {
						clear_on_edit: true,
						editdone: function(evt, tag){
							tag = tag.trim()
							// no empty tags...
							if(tag == ''){
								return
							}

							that.tag(tag, gids)

							// update tag list...
							make.dialog
								.update()
								// select the new tag...
								.then(function(){
									make.dialog.select(tag) })
						},
					})
				}

				func
					&& func.call(that, path, make, gids, opts)
			}, 
			Object.assign({ 
				cloudView: true, 
				close: function(){ that.refresh() },
			}, opts))
		})],
	showMarkedTagCoud: ['Tag|Mark/$Tag $marked images...',
		{dialogTitle: 'Tag marked images'},
		'showTagCloud: "marked"'],
	// XXX should this show all the tags or just the used???
	// XXX should we add image count to tags???
	cropTaggedFromCloud: ['Tag|Crop/$Crop $ta$gged...',
		widgets.uiDialog(function(){
			var that = this
			var tags = new Set()

			return this.showTagCloud(
				function(path, make, gids, opts){
					make.Separator()
					make.Action('$Crop', {
						open: function(){
							that.cropTagged([...tags])

							make.dialog.close()
						}
					})
				}, 
				[], 
				{
					itemOpen: function(tag, state){
						state ? 
							tags.add(tag) 
							: tags.delete(tag) },
					'noNewButton': true,
				}) })],


	// Tag tree...
	//
	get tagTree(){
		// XXX
	},

	metadataSection: [
		{ sortedActionPriority: 80 },
		function(make, gid, image){
			var that = this

			make.Separator()
			make(['$Tags:', 
				function(){
					return that.data.getTags(gid).join(', ') }], 
				{ 
					open: function(){ 
						that.showTagCloud(gid) 
							.close(function(){
								make.dialog.update() }) }, 
				}) }],
})


var TagUI = 
module.TagUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX
	tag: 'ui-tags',
	depends: [
		'ui',
	],

	actions: TagUIActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
