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

var CLI = 
module.CLI = core.ImageGridFeatures.Feature({
	title: '',
	doc: '',

	tag: 'commandline',
	depends: ['base'],

	isApplicable: function(){ 
		return this.runtime == 'node' || this.runtime == 'nw' 
	},

	handlers: [
		['start',
			function(){
				// get the arguments...
				if(this.runtime == 'nw'){
					var argv = requirejs('nw.gui').App.argv

					// XXX 
					console.log('>>>>', argv)

				} else if(this.runtime == 'node'){
					var argv = process.argv
				}



				var cli = requirejs('commander')
				cli
					// XXX get the version from config...
					.version('0.0.1')
					//.usage('[command] [options] ..')

					.option('--list-features', 'list loaded features')

					//.command('index [path]', 'build an index of path')

					.arguments('<action> [args]')
					.action(function(action, args){
						console.log('>>>>', action, args)
					})

					.parse(argv)


				// list features...
				// XXX make this a core action... (???)
				if(cli.listFeatures){
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
				}
			}]
	],
})






/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
