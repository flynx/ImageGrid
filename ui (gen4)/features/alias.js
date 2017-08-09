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

var Alias = 
module.Alias = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'alias',
	suggested: [
		'ui-alias',
	],

	config: {
		//aliases: {
		//},
	},

	handlers: [
		// load aliases...
		['start',
			function(){
				var that = this
				var aliases = this.config.aliases || {}

				Object.keys(aliases)
					.forEach(function(alias){
						that.alias(alias, aliases[alias]) })
			}],
		// store aliases in .config.aliases
		// XXX should we guard from overriding actions???
		['alias',
			function(_, alias, target){
				// remove alias...
				// XXX is this test enough??? ...see ActionSet.alias(..)
				if(arguments.length == 3 
						&& (target === null || target === false)){
					var aliases = this.config.aliases || {}

					delete aliases[alias]

					if(Object.keys(alias).length == 0){
						delete this.config.aliases
					}

				// save alias...
				} else {
					var aliases = this.config.aliases = this.config.aliases || {}

					aliases[alias] = target
				}
			}]],
})



//---------------------------------------------------------------------

var UIAliasActions = actions.Actions({
	browseAliases: ['System/Aliases...',
		widgets.makeUIDialog(function(){
			var that = this
			return browse.makeLister(null, 
				function(path, make){
					var aliases = that.config.aliases || {}

					var names = Object.keys(aliases)

					names.length > 0 ?
						names
							.forEach(function(name){
								make([name, aliases[name]])
									.on('open', function(){ that.editAlias(name) })
							})
						: make.Empty()
				}, {
					cls: 'table-view',
				})
		})],

	editAlias: ['- System/Edit alias...',
		widgets.makeUIDialog(function(alias){
			var that = this
			return browse.makeLister(null, 
				function(path, make){
					make.Editable(['Alias:', alias], 
						{
							start_on: 'open',
							edit_text: 'last',
							clear_on_edit: false,
							reset_on_commit: false,
						})
						.on('edit-commit', 
							function(evt, text){ 
						   	})

					make.Editable(['Code:', that.config.aliases[alias]], 
						{
							start_on: 'open',
							edit_text: 'last',
							clear_on_edit: false,
							reset_on_commit: false,
						})
						.on('edit-commit', 
							function(evt, text){ 
						   	})

					make('---')

					make.ConfirmAction('Delete', {})
				}, {
					cls: 'table-view',
				})
		})],
})

var UIAlias = 
module.UIAlias = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'ui-alias',
	depends: [
		'alias',
		'ui',
	],

	actions: UIAliasActions, 

	handlers: [],
})




/**********************************************************************
* vim:set ts=4 sw=4 :                               */ return module })
