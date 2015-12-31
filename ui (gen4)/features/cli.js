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
				if(this.runtime == 'nw'){
					var argv = requirejs('nw.gui').App.argv
				} else if(this.runtime == 'node'){
					var argv = process.argv
				}

				// XXX for some reason this always contains --help in nw...
				//console.log('>>>>', argv)


				var cli = requirejs('commander')
					.version('0.0.1')
					.usage('[command] [options] ..')
					.option('--features', 'list loaded features')
					.command('index [path]', 'build and index of path')
					.parse(argv)


				// list features...
				// XXX make this a core action...
				if(cli.features){
					this.features.excluded.length > 0 
						&& console.warn('Features excluded (%d):\n   ',
							this.features.excluded.length, 
							this.features.excluded.join('\n    '))
					console.log('Features not applicable (%d):\n   ', 
						this.features.unapplicable.length, 
						this.features.unapplicable.join('\n    '))
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
