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
						that.alias.apply(that, [alias].concat(aliases[alias])) })
			}],
		// store aliases in .config.aliases
		//
		// NOTE: this does not guard from overriding anything...
		// NOTE: there should not be any actions in the base action-set 
		// 		other than the ones created by .alias(..).
		['alias',
			function(_, alias, target){
				var args = [...arguments].slice(1)
				var alias = args.shift()
				var target = args[args.length-1]

				// remove alias...
				// XXX is this test enough??? ...see ActionSet.alias(..)
				if(arguments.length == 3 
						&& (target === null || target === false)){
					var aliases = this.config.aliases || {}

					delete aliases[alias]

					if(Object.keys(aliases).length == 0){
						delete this.config.aliases
					}

				// save alias...
				} else {
					var aliases = this.config.aliases = this.config.aliases || {}

					aliases[alias] = args
				}
			}],

		/*/ XXX not sure if this is the correct way to go...
		['selfTest',
			function(){
				var alias = [
					'testRuntimeAlias', 
					'Test/',
					core.doc`Rumtime-defined test alias.
						
						NOTE: this will get overwritten on start.`,
					'focusImage: "next"',
				]

				this.alias.apply(this, alias)

				if(!this.config.aliases
						|| !(alias[0] in this.config.aliases)
						|| this.config.aliases[alias[0]].length != alias.length-1
						|| this.config.aliases[alias[0]].filter(function(e, i){ return e != alias[i+1] }).length > 0){
					console.error('Alias save fail:',
						'\n  written:', alias,
						'\n  saved:', [alias[0]].concat((this.config.aliases || {})[alias[0]]))
				}
			}],
		//*/
	],
})



//---------------------------------------------------------------------

var UIAliasActions = actions.Actions({
	browseAliases: ['System/Aliases...',
		core.doc`Action alias list

			NOTE: this may affect the action menu, to see changes update the menu.`,
		widgets.makeUIDialog(function(){
			var that = this

			// get keys for each action...
			var keys = that.getKeysForAction ? that.getKeysForAction() : {}
			// Get keys for action...
			var getKeys = function(action){
				return (keys[action] || []).join(' / ') }

			var to_remove = []

			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
					var aliases = that.config.aliases || {}

					var names = Object.keys(aliases)

					names.length > 0 ?
						make.EditableList(names, 
							{
								new_item: false,
								to_remove: to_remove,
								editable_items: false,

								update_merge: 'drop_changes',

								itemopen: function(_, name){
									that.editAlias(name) 
										.on('close', function(){ dialog.update() })
								},

								each: function(name, elem){
									$(elem)
										.attr({
											keys: getKeys(name),
											action: name,
										})
								},
							})
						: make.Empty()

					make('---')

					make('$New...', { events: {
						open: function(){ 
							that.editAlias() 
								.on('close', function(){ dialog.update() })
						},
					} })
				}, {
					cls: 'table-view show-keys',
				})
				.run(function(){
					// XXX this is a copy from .browseActions(..)
					this.showDoc = function(){
						var action = this.select('!').attr('action')
						action 
							&& that.showDoc(action)
					}
					this.keyboard.handler('General', '?', 'showDoc')
				})
				.close(function(){
					to_remove.forEach(function(alias){
						that.alias(alias, null) }) })
		})],

	// NOTE: this does not include an attr editor by design...
	//
	// XXX should we set white-space: pre on doc here or in css???
	// XXX edit key bindings (???)
	editAlias: ['- System/Edit alias...',
		widgets.makeUIDialog(function(alias){
			var that = this

			var name = alias
			var data = ((that.config.aliases || {})[alias] || ['']).slice()

			return browse.makeLister(null, 
				function(path, make){
					var item_opts = {
						start_on: 'open',
						edit_text: 'last',
						clear_on_edit: false,
						reset_on_commit: false,
						abort_on_deselect: false, 
					}

					// doc fields...
					make.Editable(['$Path:', that.getActionAttr(alias, 'doc')], item_opts)
						.on('edit-commit', function(evt, text){ 
							if(data.length > 1 && typeof(data[0]) == typeof('str')){
								data[0] = text

							// no previous docs...
							} else {
								data.splice(0, 0, text)
							}
						})
					var doc_opts = {
						// XXX this does not work???
						multiline: true,
					}
					doc_opts.__proto__ = item_opts
					make.Editable(['$Doc:', that.getActionAttr(alias, 'long_doc')], doc_opts)
						.on('edit-commit', function(evt, text){ 
							// existing .doc and .long_doc -> replace .long_doc...
							if(data.length > 2 
									&& typeof(data[0]) == typeof('str')
									&& typeof(data[1] == typeof('str'))){
								data[1] = text

							// existing .doc -> add .long_doc only...
							} else if(data.length > 1 && typeof(data[0]) == typeof('str')){
								data.splice(1, 0, text)

							// no previous docs -> add empty .doc and set .long_doc...
							} else {
								data.splice(0, 0, '', text)
							}
						})
						// XXX HACK???
						.find('.text').last()
							.css({'white-space': 'pre'})

					make('---')

					// alias fields...
					make.Editable(['$Alias:', alias || ''], item_opts)
						.on('edit-commit', function(evt, text){ 
							name = text
						})
					make.Editable(['$Code:', ((that.config.aliases || {})[alias] || ['']).slice(-1)[0]], item_opts)
						.on('edit-commit', function(evt, text){ 
							data[data.length-1] = text
						})

					make('---')

					// delete / cancel...
					make.ConfirmAction('Delete', {
						callback: function(){
							data = [null]
							make.dialog.close()
						},
						buttons: [
							['Cancel edit', function(){ 
								make.dialog.close('cancel')
							}],
						],
					})
				}, {
					cls: 'table-view',
				})
				.on('close', function(_, mode){
					// do not save on cancel...
					if(mode == 'cancel' 
							|| ((name == '' || name == null) && !that[name])){
						return
					}

					// renaming the alias -> clear the old value...
					if(name != alias){
						that.alias(alias, null)
					}

					// save the alias...
					that.alias.apply(that, [name].concat(data))
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
