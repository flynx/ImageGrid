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
						that.alias.apply(that, [alias].concat(aliases[alias])) })
			}],
		// store aliases in .config.aliases
		// XXX should we guard from overriding actions???
		['alias',
			function(_, alias, target){
				var args = [].slice.call(arguments, 1)
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
			}]],
})



//---------------------------------------------------------------------

var UIAliasActions = actions.Actions({
	// XXX add run button (???) 
	// XXX show alias docs (???)
	// XXX show key bindings
	// XXX edit key bindings (???)
	// XXX should this update the parent???
	browseAliases: ['System/Aliases...',
		widgets.makeUIDialog(function(){
			var that = this
			return browse.makeLister(null, 
				function(path, make){
					var dialog = this
					var aliases = that.config.aliases || {}

					var names = Object.keys(aliases)

					names.length > 0 ?
						names
							.forEach(function(name){
								make([name, (aliases[name]).slice(-1)[0]])
									.on('open', function(){ 
										that.editAlias(name) 
											.on('close', function(){ dialog.update() })
									})
							})
						: make.Empty()

					make('---')

					make('New...')
						.on('open', function(){ 
							that.editAlias() 
								.on('close', function(){ dialog.update() })
						})
				}, {
					cls: 'table-view',
				})
		})],

	// NOTE: this does not include an attr editor by design...
	editAlias: ['- System/Edit alias...',
		widgets.makeUIDialog(function(alias){
			var that = this
			return browse.makeLister(null, 
				function(path, make){
					var dialog = this

					var item_opts = {
						start_on: 'open',
						edit_text: 'last',
						clear_on_edit: false,
						reset_on_commit: false,
						// XXX bug -- error + clear field???
						//abort_on_deselect: false, 
					}
					var data = (that.config.aliases || {})[alias] || ['']

					// doc fields...
					make.Editable(['Path:', that.getActionAttr(alias, 'doc')], item_opts)
						.on('edit-commit', 
							function(evt, text){ 
								if(data.length > 1 && typeof(data[0]) == typeof('str')){
									data[0] = text

								// no previous docs...
								} else {
									data.splice(0, 0, text)
								}

								that.alias.apply(that, [alias].concat(data))
						   	})
					make.Editable(['Doc:', that.getActionAttr(alias, 'long_doc')], item_opts)
						.on('edit-commit', 
							function(evt, text){ 
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

								that.alias.apply(that, [alias].concat(data))
						   	})

					make('---')

					// alias fields...
					make.Editable(['Alias:', alias || ''], item_opts)
						.on('edit-commit', 
							function(evt, text){ 
								that.alias(alias, null)
								that.alias.apply(that, [text].concat(data))
								alias = text
						   	})
					make.Editable(['Code:', ((that.config.aliases || {})[alias] || ['']).slice(-1)[0]], item_opts)
						.on('edit-commit', 
							function(evt, text){ 
								data[data.length-1] = text
								that.alias.apply(that, [alias].concat(data))
							})

					make('---')

					make.ConfirmAction('Delete', {
						callback: function(){
							that.alias(alias, null)
							dialog.close()
						},
					})
				}, {
					cls: 'table-view',
				})
		})],


	/* XXX do we need this???
	_browseAliases: ['System/Aliases/*', 
		function(path, make){
			var that = this
			this.aliases.forEach(function(alias){
				make(alias)
					.on('open', function(){ that[alias]() })
			})
		}],
	//*/
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
