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
// Persistent tags (tree) 
//
// XXX add save/load tree to fs...

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
// Persistent tags UI...
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
		// XXX do a whitepaper (RFC?) on this system when done...
		'base-tags': [
			'count',
			'count/one',
			'count/two',
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

			'name',

			'role',
			'role/photographer',
			'role/artist',
			'role/painter',

			'color',
			'color/red',
			'color/green',
			'color/blue',
			'color/white',
			'color/black',
			'color/orange',
			'color/yellow',
			'color/gray',

			// XXX should this be 'type' or something else???
			'genre',
			'genre/documentary',
			'genre/landscape',
			'genre/portrait',
			'genre/wildlife',
			'genre/macro',
			'genre/abstract',
			'genre/sport',

			'activity',
			'activity/sport',
			'activity/sport/football',
			'activity/sport/american-football',
			'activity/sport/baseball',
			'activity/sport/tennis',
			// ...
		],
	},

	// Tag cloud/list...
	//
	// XXX move this to the base tags feature...
	get tags(){
		return []
			// XXX load this from a file...
			.concat((this.config['base-tags'] || [])
				// split tag paths...
				.map(function(e){ return e.split(/[\\\/]/g) })
				.flat()) 
			.concat(Object.keys((this.data || {}).tags || {}))
   			.unique() },

	// XXX use global tag list... (???) 
	// XXX make this reusable...
	showTagCloud: ['Tag|Edit|Image/$Tags...',
		core.doc`
		`,
		{dialogTitle: function(_, gids){ 
			return (gids.length == 1 && gids[0] == 'marked') ?
					'Marked image tags'
				: gids.length > 1 ?
					'Tags of: '+ gids.join(', ')
				: 'Tags' }},
		widgets.makeUIDialog(function(...gids){
			var that = this
			gids = gids.length == 0 ? ['current'] : gids
			// handle 'marked' keyword...
			gids = gids
				.map(function(gid){
					return gid == 'marked' ? that.marked : gid })
				.reduce(function(res, cur){
					return res.concat(cur instanceof Array ? cur : [cur]) }, [])
				.unique()

			// XXX
			var removeTag = function(tag){
				console.log('REMOVE TAG:', tag)
				// XXX
			}

			return browse.makeLister(null, function(path, make){
				var tags = that.data.getTags(gids)

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
					.map(function(tag){
						return make(tag, {
							cls: tags.indexOf(tag) >= 0 ? 'tagged' : '',
							style: {
								opacity: tags.indexOf(tag) >= 0 ? '' : '0.3'
							},
							open: function(){
								var e = $(this)
								var on = e.css('opacity')
								on = on == '' || on == '1'

								e.css('opacity', on ? 0.3 : '')

								on ?
									that.untag(tag, gids)
									: that.tag(tag, gids)
							},
							buttons: [
								// remove tag button...
								['&times;', removeTag.bind(that, tag) ],
							],
						})
					})

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
			}, { 
				cloudView: true, 
				close: function(){ that.refresh() },
			})
		})],
	showMakedTagCoud: ['Tag|Mark/$Tags of marked images...',
		'showTagCloud: "marked"'],
	
	// XXX crop/filter by tags...
	// XXX
	cropTaggedFromCloud: ['-Tag|Crop/Crop tagged...',
		widgets.makeUIDialog(function(){
			// XXX
		})],


	// Tag tree...
	//
	get tagTree(){
		// XXX
	},

})


var TagUI = 
module.TagUI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	// XXX
	tag: 'ui-tags',
	depends: [
		// XXX
	],

	actions: TagUIActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
