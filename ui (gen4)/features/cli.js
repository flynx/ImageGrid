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
var ribbons = require('ribbons')

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
				console.log('>>>>', argv)

				var cli = requirejs('commander')

				cli
					.version('0.0.1')
					.usage('COMMAND OPTION ..')
					.command('index PATH', 'build and index of path')
					.parse(argv)
			}]
	],
})






/**********************************************************************
* vim:set ts=4 sw=4 :                                                */
return module })
