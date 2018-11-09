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
				Object.keys(that.data.tags || {})
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
