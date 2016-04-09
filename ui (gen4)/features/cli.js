/**********************************************************************
* 
*
*
**********************************************************************/

define(function(require){ var module = {}

//var DEBUG = DEBUG != null ? DEBUG : true

var actions = require('lib/actions')
var features = require('lib/features')

var data = require('data')
var images = require('images')

var core = require('features/core')
var base = require('features/base')



/*********************************************************************/
// XXX what we need here is:
// 		- base introspection
// 			- list features
// 			- list actions
// 			- list action scripts / commands
// 		- call action
// 		- call action script (a-la git commands)
//
// XXX the main functionality:
// 		- make previews
// 		- make index
// 		- merge
// 		- clone
//
// XXX a different approach to this would be an "external" cli controller
// 		script that would contain only cli code and load the ImageGrid
// 		only in the handler...
// 			+ would be allot faster to load.
// 			+ more flexible as we can load more than one instance...
// 		This could still be done via features, just load the cli feature
// 		alone at first and then either create new instances or setup 
// 		additional features as needed...

var CLI = 
module.CLI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'commandline',
	depends: ['lifecycle'],

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' },

	handlers: [
		['start',
			function(){
				var that = this
				// get the arguments...
				if(this.runtime == 'nw'){
					var argv = requirejs('nw.gui').App.argv

					// XXX appears to have a stray '--help' lodged in 
					// 		all the time...
					// 		...need to test this with a packed exec...
					console.log('>>>>', argv)

				} else if(this.runtime == 'node'){
					var argv = process.argv
				}


				var cli = requirejs('commander')
				cli
					// XXX get the version from config...
					.version('0.0.1')
					//.usage('[command] [options] ..')

					// list features...
					// XXX make this a core action... (???)
					.option('lf, --list-features', 'list loaded features', function(){
						// excluded...
						that.features.excluded.length > 0 
							&& console.warn('Features excluded (%d):\n   ',
								that.features.excluded.length, 
								that.features.excluded.join('\n    '))

						// not applicable...
						that.features.unapplicable.length > 0 
							&& console.log('Features not applicable (%d):\n   ', 
								that.features.unapplicable.length, 
								that.features.unapplicable.join('\n    '))

						// loaded...
						console.log('Features loaded (%d):\n   ',
							that.features.features.length, 
							that.features.features.join('\n    '))
					})
					.option('laf, --list-available-features', 'list available features', function(){
						var f = core.ImageGridFeatures.features
						console.log('Features available (%d):\n   ',
							f.length, 
							f.join('\n    '))
					})

					// list actions...
					// XXX this is a bit pointless as single actions are
					// 		meaningless when no state is stored...
					.option('la, --list-actions', 'list loaded actions', function(){
						console.log('Actions loaded (%d):\n   ', 
							that.length, 
							Object.keys(that.getDoc()).join('\n    '))
					})

					// XXX experimental....
					// 		to see this in action use:
					// 			ig lf sm lf
					// 		...this will print the list of features before
					// 		and after setup...
					.option('sm, --setup-minimal', 'setup minimal features', function(){
						// load features we might need...
						// XXX require js loads these at the root...
						var location = require('features/location')
						var history = require('features/history')
						var app = require('features/app')
						var marks = require('features/ui-marks')
						var filesystem = require('features/filesystem')
						var metadata = require('features/metadata')
						var experimental = require('features/experimental')

						// extend the current instance to a minimal non-ui
						// state...
						core.ImageGridFeatures
							.setup(that, ['viewer-minimal'])
					})

					// XXX the problem with this is that it still tires 
					// 		to find and run 'ig-index'...
					/*
					.command('index [path]', 'build an index of path', function(path){
						console.log('!!!!!! INDEX', path)
					})
					*/

					.arguments('<action> [args]')
					.action(function(action, args){
						// XXX
						console.log('>>>>', action, args)
					})

					.parse(argv)
			}]
	],
})



/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
