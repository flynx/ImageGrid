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

var CLI = 
module.CLI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'commandline',
	depends: ['base'],

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' },

	handlers: [
		['start',
			function(){
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
					.option('--list-features', 'list loaded features', function(){
						// excluded...
						this.features.excluded.length > 0 
							&& console.warn('Features excluded (%d):\n   ',
								this.features.excluded.length, 
								this.features.excluded.join('\n    '))

						// not applicable...
						console.log('Features not applicable (%d):\n   ', 
							this.features.unapplicable.length, 
							this.features.unapplicable.join('\n    '))

						// loaded...
						console.log('Features loaded (%d):\n   ',
							this.features.features.length, 
							this.features.features.join('\n    '))
					})

					// list actions...
					// XXX this is a bit pointless as single actions are
					// 		meaningless when no state is stored...
					.option('--list-actions', 'list loaded actions', function(){
						console.log('Actions loaded (%d):\n   ', 
							this.length, 
							Object.keys(this.getDoc()).join('\n    '))
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
